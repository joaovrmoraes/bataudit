package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/queue"
)

// Service manages the workers that process events from the queue
type Service struct {
	config     *Config
	auditSvc   *audit.Service
	redisQueue *queue.RedisQueue

	// Worker management
	activeWorkers  int               // Current number of active workers
	workerChannels map[int]chan bool // Channels to signal workers to stop
	workerMutex    sync.Mutex        // Mutex to protect worker operations

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

// Start starts the workers and waits until the context is canceled
func (s *Service) Start(ctx context.Context) error {
	var wg sync.WaitGroup

	fmt.Printf("Starting with %d workers (min: %d, max: %d) processing queue %s\n",
		s.config.InitialWorkerCount, s.config.MinWorkerCount, s.config.MaxWorkerCount, s.config.QueueName)

	// initial start of monitoring with autoscaling support
	wg.Add(1)
	go s.monitorQueueWithAutoscaling(ctx, &wg)

	// Start initial workers
	s.scaleWorkers(ctx, &wg, s.config.InitialWorkerCount)

	// Wait for all workers to finish
	wg.Wait()
	fmt.Println("All workers have been stopped.")
	return nil
}

// monitorQueueWithAutoscaling - monitors the queue size periodically and manages worker autoscaling
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

			if err == nil {
				s.workerMutex.Lock()
				activeWorkers := s.activeWorkers
				s.workerMutex.Unlock()

				fmt.Printf("[Monitor] Queue status %s: %d item(s), Active workers: %d\n",
					s.config.QueueName, queueLen, activeWorkers)

				// Update metrics for autoscaling decisions
				s.scalingMetrics.lastQueueSize = queueLen

				// Only consider scaling if autoscaling is enabled
				if s.config.EnableAutoscaling {
					timeSinceLastScale := time.Since(s.lastScaleTime)

					if timeSinceLastScale > s.config.CooldownPeriod {
						fmt.Printf("[Autoscale] Cooldown period passed (%.1fs), evaluating scaling needs...\n",
							timeSinceLastScale.Seconds())
						s.evaluateScaling(ctx, wg, queueLen)
					} else {
						fmt.Printf("[Autoscale] In cooldown period (%.1fs remaining), waiting...\n",
							(s.config.CooldownPeriod - timeSinceLastScale).Seconds())

						// Escala emergencial - se a fila estiver crescendo muito rápido, ignora o cooldown
						if queueLen > s.config.ScaleUpThreshold*5 && activeWorkers < s.config.MaxWorkerCount {
							fmt.Printf("[Autoscale] EMERGENCY SCALE: Queue exceeds 5x threshold during cooldown, forcing scale up\n")
							s.evaluateScaling(ctx, wg, queueLen)
						}
					}
				}
			} else {
				fmt.Printf("[Monitor] Error checking queue size: %v\n", err)
			}
		}
	}
}

// runWorkerWithControl runs an individual worker with a dedicated stop channel for autoscaling
func (s *Service) runWorkerWithControl(ctx context.Context, id int, wg *sync.WaitGroup, stopChan <-chan bool) {
	defer wg.Done()

	fmt.Printf("Worker %d started\n", id)

	// Ticker for periodic polling
	ticker := time.NewTicker(s.config.PollDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			fmt.Printf("Worker %d stopped (context done)\n", id)
			return

		case <-stopChan:
			fmt.Printf("Worker %d stopped (autoscaling)\n", id)
			return

		case <-ticker.C:
			// Try to get an item from the queue with a short timeout
			ctxDequeue, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			data, err := s.redisQueue.Dequeue(ctxDequeue)
			cancel()

			if err != nil {
				// Ignore timeout errors during polling
				if err.Error() == "context deadline exceeded" {
					continue
				}

				fmt.Printf("Worker %d: Error dequeuing item: %v\n", id, err)
				continue
			}

			// If there's no data, continue silently
			if data == nil {
				continue
			}

			// Check queue size
			ctxQueueLen, cancelQueueLen := context.WithTimeout(context.Background(), 1*time.Second)
			queueLen, errQueueLen := s.redisQueue.QueueLength(ctxQueueLen)
			cancelQueueLen()

			queueSizeInfo := "unknown queue size"
			if errQueueLen == nil {
				queueSizeInfo = fmt.Sprintf("%d item(s) remaining in queue", queueLen)
			}

			// Process the item
			var auditEvent audit.Audit
			if err := json.Unmarshal(data, &auditEvent); err != nil {
				fmt.Printf("Worker %d: Failed to deserialize event: %v\n", id, err)
				continue
			}

			fmt.Printf("Worker %d: Processing event %s (%s)\n", id, auditEvent.ID, queueSizeInfo)

			// Try to process with retries
			success := s.processWithRetry(id, auditEvent)
			if !success {
				fmt.Printf("Worker %d: Failed to process event after %d attempts\n", id, s.config.MaxRetries)
			}
		}
	}
}

// processWithRetry tries to process an event with retries in case of failure
func (s *Service) processWithRetry(id int, auditEvent audit.Audit) bool {
	for attempt := 0; attempt < s.config.MaxRetries; attempt++ {
		err := s.auditSvc.CreateAudit(auditEvent)
		if err == nil {
			fmt.Printf("Worker %d: Event processed successfully %s\n", id, auditEvent.ID)
			return true
		}

		fmt.Printf("Worker %d: Attempt %d failed: %v\n", id, attempt+1, err)
		time.Sleep(2 * time.Second) // Wait before trying again
	}
	return false
}
