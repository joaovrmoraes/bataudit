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
}

// NewService creates a new instance of the worker service
func NewService(config *Config, auditSvc *audit.Service, redisQueue *queue.RedisQueue) *Service {
	return &Service{
		config:     config,
		auditSvc:   auditSvc,
		redisQueue: redisQueue,
	}
}

// Start starts the workers and waits until the context is canceled
func (s *Service) Start(ctx context.Context) error {
	var wg sync.WaitGroup

	fmt.Printf("Starting %d workers processing queue %s\n", s.config.WorkerCount, s.config.QueueName)

	// Iniciar monitoramento periódico da fila
	wg.Add(1)
	go s.monitorQueueSize(ctx, &wg)

	// Start the workers
	for i := 0; i < s.config.WorkerCount; i++ {
		wg.Add(1)
		go s.runWorker(ctx, i, &wg)
	}

	// Wait for all workers to finish
	wg.Wait()
	fmt.Println("All workers have been stopped.")
	return nil
}

// monitorQueueSize - monitors the queue size periodically
func (s *Service) monitorQueueSize(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
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
				fmt.Printf("[Monitor] Status da fila %s: %d item(s)\n", s.config.QueueName, queueLen)
			} else {
				fmt.Printf("[Monitor] Erro ao verificar tamanho da fila: %v\n", err)
			}
		}
	}
}

// runWorker runs an individual worker that processes events from the queue
func (s *Service) runWorker(ctx context.Context, id int, wg *sync.WaitGroup) {
	defer wg.Done()

	fmt.Printf("Worker %d started\n", id)

	// Ticker for periodic polling
	ticker := time.NewTicker(s.config.PollDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			fmt.Printf("Worker %d stopped\n", id)
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

			// Verificar tamanho da fila
			ctxQueueLen, cancelQueueLen := context.WithTimeout(context.Background(), 1*time.Second)
			queueLen, errQueueLen := s.redisQueue.QueueLength(ctxQueueLen)
			cancelQueueLen()

			queueSizeInfo := "tamanho da fila desconhecido"
			if errQueueLen == nil {
				queueSizeInfo = fmt.Sprintf("%d item(s) restante(s) na fila", queueLen)
			}

			// Process the item
			var auditEvent audit.Audit
			if err := json.Unmarshal(data, &auditEvent); err != nil {
				fmt.Printf("Worker %d: Failed to deserialize event: %v\n", id, err)
				continue
			}

			fmt.Printf("Worker %d: Processando evento %s (%s)\n", id, auditEvent.ID, queueSizeInfo)

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
