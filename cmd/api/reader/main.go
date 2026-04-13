// @title           BatAudit API
// @version         1.0
// @description     Self-hosted audit logging platform. Collect, store and query audit events from any service.
// @contact.name    BatAudit
// @license.name    MIT

// @host            localhost:8082
// @BasePath        /v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter: Bearer <token>

package main

import (
	"log/slog"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	_ "github.com/joaovrmoraes/bataudit/docs"
	"gorm.io/gorm"
)

func main() {
	setupLogger()

	conn := connectDB()
	sqlDB, err := conn.DB()
	if err != nil {
		slog.Error("Failed to get underlying DB connection", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	jwtSecret := config.GetEnv("JWT_SECRET", "change-me-in-production")
	authRepo := auth.NewRepository(conn)
	authService := auth.NewService(authRepo, jwtSecret)

	ownerEmail := config.GetEnv("INITIAL_OWNER_EMAIL", "")
	ownerPassword := config.GetEnv("INITIAL_OWNER_PASSWORD", "")
	ownerName := config.GetEnv("INITIAL_OWNER_NAME", "Admin")
	if ownerEmail != "" && ownerPassword != "" {
		if _, err := authService.SetupOwner(ownerName, ownerEmail, ownerPassword); err != nil {
			if err != auth.ErrOwnerAlreadyExists {
				slog.Error("Failed to create initial owner", "error", err)
			}
		} else {
			slog.Info("Initial owner created", "email", ownerEmail)
		}
	}

	r := gin.Default()
	r.Use(cors.Default())

	registerRoutes(r, conn, authService)

	port := config.GetEnv("API_READER_PORT", "8082")
	slog.Info("Reader server running", "port", port)
	if err := r.Run(":" + port); err != nil {
		slog.Error("Reader server failed", "error", err)
	}
}

func connectDB() *gorm.DB {
	const maxRetries = 5
	var conn *gorm.DB
	var err error
	for i := 0; i < maxRetries; i++ {
		slog.Info("Connecting to database", "attempt", i+1, "max_retries", maxRetries)
		conn, err = db.Init()
		if err == nil {
			slog.Info("Database connection established")
			return conn
		}
		slog.Warn("Database connection failed", "error", err)
		if i < maxRetries-1 {
			time.Sleep(5 * time.Second)
		}
	}
	slog.Error("Could not connect to database", "error", err, "attempts", maxRetries)
	os.Exit(1)
	return nil
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
