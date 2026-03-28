package main

import (
	"log/slog"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/health"
	"github.com/joaovrmoraes/bataudit/internal/queue"
	"gorm.io/gorm"
)

func main() {
	setupLogger()

	r := gin.Default()
	r.Use(cors.Default())

	maxRetries := 5
	var conn *gorm.DB
	var err error

	for i := 0; i < maxRetries; i++ {
		slog.Info("Connecting to database", "attempt", i+1, "max_retries", maxRetries)
		conn, err = db.Init()
		if err == nil {
			slog.Info("Database connection established")
			break
		}
		slog.Warn("Database connection failed", "error", err)
		if i < maxRetries-1 {
			slog.Info("Retrying in 5s")
			time.Sleep(5 * time.Second)
		}
	}

	if err != nil {
		slog.Error("Could not connect to database", "error", err, "attempts", maxRetries)
		os.Exit(1)
	}

	sqlDB, sqlErr := conn.DB()
	if sqlErr != nil {
		slog.Error("Failed to get underlying DB connection", "error", sqlErr)
		os.Exit(1)
	}
	defer sqlDB.Close()

	redisAddress := config.GetEnv("REDIS_ADDRESS", "localhost:6379")
	slog.Info("Connecting to Redis", "address", redisAddress)

	var redisQueue *queue.RedisQueue
	for i := 0; i < maxRetries; i++ {
		slog.Info("Connecting to Redis", "attempt", i+1, "max_retries", maxRetries)
		redisQueue, err = queue.NewRedisQueue(redisAddress, queue.DefaultQueueName)
		if err == nil {
			slog.Info("Redis connection established")
			break
		}
		slog.Warn("Redis connection failed", "error", err)
		if i < maxRetries-1 {
			slog.Info("Retrying in 5s")
			time.Sleep(5 * time.Second)
		}
	}

	if err != nil {
		slog.Error("Failed to connect to Redis", "error", err, "attempts", maxRetries)
		os.Exit(1)
	}
	defer redisQueue.Close()

	// Auth setup (API Key middleware)
	jwtSecret := config.GetEnv("JWT_SECRET", "change-me-in-production")
	authRepo := auth.NewRepository(conn)
	authService := auth.NewService(authRepo, jwtSecret)

	v1 := r.Group("/v1")
	{
		auditGroup := v1.Group("/audit")
		auditGroup.Use(authService.APIKeyMiddleware())
		repository := audit.NewRepository(conn)
		handler := audit.NewQueueHandler(repository, redisQueue, authService)
		handler.RegisterWriteRoutes(auditGroup)
	}

	healthHandler := health.NewHealthHandler(conn, "1.0.0", "development")
	healthHandler.RegisterRoutes(r.Group(""))

	port := config.GetEnv("API_WRITER_PORT", "8081")
	slog.Info("Writer server running", "port", port)
	r.Run(":" + port)
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
