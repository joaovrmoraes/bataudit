package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/worker"
)

func main() {
	setupLogger()

	conn, err := db.Init()
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	sqlDB, _ := conn.DB()
	defer sqlDB.Close()

	cfg := worker.DefaultConfig()
	worker.ConfigureFromEnv(cfg)

	maxRetries := 5

	redisQueue, err := worker.ConnectToRedisWithRetry(
		cfg.RedisAddress,
		cfg.QueueName,
		maxRetries,
	)
	if err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer redisQueue.Close()

	repository := audit.NewRepository(conn)
	auditService := audit.NewService(repository)

	workerService := worker.NewService(cfg, auditService, redisQueue)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	worker.SetupSignalHandler(ctx, cancel)

	slog.Info("Starting BatAudit worker service", "autoscaling", cfg.EnableAutoscaling)
	if err := workerService.Start(ctx); err != nil {
		slog.Error("Worker service failed", "error", err)
		os.Exit(1)
	}

	slog.Info("Application shut down successfully")
}

func setupLogger() {
	level := slog.LevelInfo
	switch config.GetEnv("LOG_LEVEL", "info") {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))
}
