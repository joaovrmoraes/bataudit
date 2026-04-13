package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/joaovrmoraes/bataudit/internal/anomaly"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/queue"
)

// Service manages the workers that process events from the queue
type Service struct {
	config     *Config
	auditSvc   *audit.Service
	detector   *anomaly.Detector // nil = anomaly detection disabled
	redisQueue *queue.RedisQueue

	// Worker management
	activeWorkers  int              // Current number of active workers
	workerChannels map[int]chan bool // Channels to signal workers to stop
	workerMutex    sync.Mutex       // Mutex to protect worker operations

	// Autoscaling
	lastScaleTime  time.Time // Last time we scaled the workers
	scalingMetrics struct {
		avgProcessingTime time.Duration
		processedEvents   int64
		lastQueueSize     int64
	}
}

// NewService creates a new instance of the worker service
func NewService(config *Config, auditSvc *audit.Service, redisQueue *queue.RedisQueue) *Service {
	return &Service{
		config:         config,
		auditSvc:       auditSvc,
		redisQueue:     redisQueue,
		activeWorkers:  0,
		workerChannels: make(map[int]chan bool),
		lastScaleTime:  time.Now(),
	}
}

// WithDetector attaches an anomaly detector to the service.
func (s *Service) WithDetector(d *anomaly.Detector) *Service {
	s.detector = d
	return s
}

// Start starts the workers and waits until the context is canceled
func (s *Service) Start(ctx context.Context) error {
	var wg sync.WaitGroup

	slog.Info("Starting workers",
		"initial", s.config.InitialWorkerCount,
		"min", s.config.MinWorkerCount,
		"max", s.config.MaxWorkerCount,
		"queue", s.config.QueueName,
	)

	wg.Add(1)
	go s.monitorQueueWithAutoscaling(ctx, &wg)

	s.scaleWorkers(ctx, &wg, s.config.InitialWorkerCount)

	wg.Wait()
	slog.Info("All workers stopped")
	return nil
}

// monitorQueueWithAutoscaling monitors the queue size periodically and manages worker autoscaling
func (s *Service) monitorQueueWithAutoscaling(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			ctxQueueLen, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			queueLen, err := s.redisQueue.QueueLength(ctxQueueLen)
			cancel()

			if err != nil {
				slog.Error("Error checking queue size", "error", err)
				continue
			}

			s.workerMutex.Lock()
			activeWorkers := s.activeWorkers
			s.workerMutex.Unlock()

			slog.Info("Queue status",
				"queue", s.config.QueueName,
				"items", queueLen,
				"active_workers", activeWorkers,
			)

			s.scalingMetrics.lastQueueSize = queueLen

			if s.config.EnableAutoscaling {
				timeSinceLastScale := time.Since(s.lastScaleTime)

				if timeSinceLastScale > s.config.CooldownPeriod {
					slog.Debug("Cooldown passed, evaluating scaling", "elapsed_s", timeSinceLastScale.Seconds())
					s.evaluateScaling(ctx, wg, queueLen)
				} else {
					remaining := (s.config.CooldownPeriod - timeSinceLastScale).Seconds()
					slog.Debug("In cooldown period", "remaining_s", remaining)

					if queueLen > s.config.ScaleUpThreshold*5 && activeWorkers < s.config.MaxWorkerCount {
						slog.Warn("Emergency scale: queue exceeds 5x threshold during cooldown")
						s.evaluateScaling(ctx, wg, queueLen)
					}
				}
			}
		}
	}
}

// runWorkerWithControl runs an individual worker with a dedicated stop channel for autoscaling
func (s *Service) runWorkerWithControl(ctx context.Context, id int, wg *sync.WaitGroup, stopChan <-chan bool) {
	defer wg.Done()

	slog.Info("Worker started", "worker_id", id)

	ticker := time.NewTicker(s.config.PollDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Worker stopped", "worker_id", id, "reason", "context_done")
			return

		case <-stopChan:
			slog.Info("Worker stopped", "worker_id", id, "reason", "autoscaling")
			return

		case <-ticker.C:
			ctxDequeue, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			data, err := s.redisQueue.Dequeue(ctxDequeue)
			cancel()

			if err != nil {
				if err.Error() == "context deadline exceeded" {
					continue
				}
				slog.Error("Error dequeuing item", "worker_id", id, "error", err)
				continue
			}

			if data == nil {
				continue
			}

			ctxQueueLen, cancelQueueLen := context.WithTimeout(context.Background(), 1*time.Second)
			queueLen, errQueueLen := s.redisQueue.QueueLength(ctxQueueLen)
			cancelQueueLen()

			var auditEvent audit.Audit
			if err := json.Unmarshal(data, &auditEvent); err != nil {
				slog.Error("Failed to deserialize event", "worker_id", id, "error", err)
				continue
			}

			remaining := int64(0)
			if errQueueLen == nil {
				remaining = queueLen
			}
			slog.Info("Processing event", "worker_id", id, "event_id", auditEvent.ID, "queue_remaining", remaining)

			if !s.processWithRetry(id, auditEvent) {
				slog.Error("Failed to process event after max retries", "worker_id", id, "event_id", auditEvent.ID, "max_retries", s.config.MaxRetries)
			}
		}
	}
}

// processWithRetry tries to process an event with retries in case of failure
func (s *Service) processWithRetry(id int, auditEvent audit.Audit) bool {
	for attempt := 0; attempt < s.config.MaxRetries; attempt++ {
		err := s.auditSvc.CreateAudit(auditEvent)
		if err == nil {
			slog.Info("Event processed", "worker_id", id, "event_id", auditEvent.ID)
			if s.detector != nil && auditEvent.EventType != "system.alert" {
				s.detector.ProcessEvent(anomaly.Event{
					ProjectID:   auditEvent.ProjectID,
					ServiceName: auditEvent.ServiceName,
					Environment: auditEvent.Environment,
					Timestamp:   auditEvent.Timestamp,
					StatusCode:  auditEvent.StatusCode,
					Method:      string(auditEvent.Method),
					Path:        auditEvent.Path,
					Identifier:  auditEvent.Identifier,
				})
			}
			return true
		}
		slog.Warn("Processing attempt failed", "worker_id", id, "attempt", attempt+1, "error", err)
		time.Sleep(2 * time.Second)
	}
	return false
}
