package worker

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joaovrmoraes/bataudit/internal/queue"
)

// ConnectToRedisWithRetry - try to connect to Redis with multiple attempts
func ConnectToRedisWithRetry(address, queueName string, maxRetries int) (*queue.RedisQueue, error) {
	var redisQueue *queue.RedisQueue
	var err error

	for i := 0; i < maxRetries; i++ {
		fmt.Printf("Trying to connect to Redis (attempt %d of %d)...\n", i+1, maxRetries)
		redisQueue, err = queue.NewRedisQueue(address, queueName)
		if err == nil {
			fmt.Println("Successfully connected to Redis!")
			return redisQueue, nil
		}

		fmt.Printf("Error connecting to Redis: %v\n", err)
		if i < maxRetries-1 {
			waitTime := time.Duration(2<<uint(i)) * time.Second
			fmt.Printf("Retrying in %v...\n", waitTime)
			time.Sleep(waitTime)
		}
	}

	return nil, fmt.Errorf("could not connect to Redis after %d attempts: %w", maxRetries, err)
}

// SetupSignalHandler sets up a handler for interrupt signals
func SetupSignalHandler(ctx context.Context, cancel context.CancelFunc) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		select {
		case <-sigChan:
			fmt.Println("\nInterrupt signal received. Shutting down workers...")
			cancel()
		case <-ctx.Done():
			// Context was already canceled elsewhere
			return
		}
	}()
}
