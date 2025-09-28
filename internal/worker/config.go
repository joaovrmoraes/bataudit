package worker

import (
	"time"

	"github.com/joaovrmoraes/bataudit/internal/queue"
)

// Config contains all configurations for the worker
type Config struct {
	WorkerCount  int
	MaxRetries   int
	PollDuration time.Duration
	RedisAddress string
	QueueName    string
}

// DefaultConfig returns a default configuration for the worker
func DefaultConfig() *Config {
	return &Config{
		WorkerCount:  4,
		MaxRetries:   3,
		PollDuration: 2 * time.Second,
		RedisAddress: "localhost:6379",
		QueueName:    queue.DefaultQueueName,
	}
}
