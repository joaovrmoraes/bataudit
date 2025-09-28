package main

import (
	"context"
	"fmt"
	"log"

	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/worker"
)

func main() {
	// Database connection
	conn := db.Init()
	sqlDB, _ := conn.DB()
	defer sqlDB.Close()

	// Load worker configuration with autoscaling
	config := worker.DefaultConfig()

	// Custom configuration from environment variables
	// This allows for dynamic configuration in different environments
	worker.ConfigureFromEnv(config)

	maxRetries := 5

	// Connect to Redis with retry
	redisQueue, err := worker.ConnectToRedisWithRetry(
		config.RedisAddress,
		config.QueueName,
		maxRetries,
	)

	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisQueue.Close()

	// Audit service
	repository := audit.NewRepository(conn)
	auditService := audit.NewService(repository)

	// Create worker service
	workerService := worker.NewService(config, auditService, redisQueue)

	// Context with cancellation for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup handler for interrupt signals
	worker.SetupSignalHandler(ctx, cancel)

	// Start workers with autoscaling enabled
	fmt.Println("Starting BatAudit worker service with autoscaling...")
	if err := workerService.Start(ctx); err != nil {
		log.Fatalf("Worker service failed: %v", err)
	}

	fmt.Println("Application shut down successfully.")
}
