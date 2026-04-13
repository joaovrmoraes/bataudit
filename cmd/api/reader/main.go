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
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/anomaly"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	_ "github.com/joaovrmoraes/bataudit/docs"
	"github.com/joaovrmoraes/bataudit/internal/health"
	hcpkg "github.com/joaovrmoraes/bataudit/internal/healthcheck"
	"github.com/joaovrmoraes/bataudit/internal/notification"
	"github.com/joaovrmoraes/bataudit/internal/tiering"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/gorm"
)

func main() {
	setupLogger()

	r := gin.Default()
	r.Use(cors.Default())

	maxRetries := 5
	var conn *gorm.DB
	var dbErr error

	for i := 0; i < maxRetries; i++ {
		slog.Info("Connecting to database", "attempt", i+1, "max_retries", maxRetries)
		conn, dbErr = db.Init()
		if dbErr == nil {
			slog.Info("Database connection established")
			break
		}
		slog.Warn("Database connection failed", "error", dbErr)
		if i < maxRetries-1 {
			slog.Info("Retrying in 5s")
			time.Sleep(5 * time.Second)
		}
	}

	if dbErr != nil {
		slog.Error("Could not connect to database", "error", dbErr, "attempts", maxRetries)
		os.Exit(1)
	}

	sqlDB, sqlErr := conn.DB()
	if sqlErr != nil {
		slog.Error("Failed to get underlying DB connection", "error", sqlErr)
		os.Exit(1)
	}
	defer sqlDB.Close()

	// Auth setup
	jwtSecret := config.GetEnv("JWT_SECRET", "change-me-in-production")
	authRepo := auth.NewRepository(conn)
	authService := auth.NewService(authRepo, jwtSecret)
	authHandler := auth.NewHandler(authService)

	// Initial owner setup
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

	v1 := r.Group("/v1")

	// Public auth routes
	authGroup := v1.Group("/auth")
	authHandler.RegisterPublicRoutes(authGroup)

	// Protected auth + management routes
	protectedAuth := v1.Group("/auth")
	protectedAuth.Use(authService.JWTMiddleware())
	authHandler.RegisterProtectedRoutes(protectedAuth)

	// Protected audit routes
	auditGroup := v1.Group("/audit")
	auditGroup.Use(authService.JWTMiddleware())
	repository := audit.NewRepository(conn)
	handler := audit.NewHandler(repository)
	handler.RegisterReadRoutes(auditGroup)

	// Anomaly detection routes
	anomalyGroup := v1.Group("/anomaly")
	anomalyGroup.Use(authService.JWTMiddleware())
	anomalyRepo := anomaly.NewRepository(conn)
	anomalyHandler := anomaly.NewHandler(anomalyRepo)
	anomalyHandler.RegisterRoutes(anomalyGroup)

	// Tiering / history routes
	tieringRepo := tiering.NewRepository(conn)
	tieringHandler := tiering.NewHandler(tieringRepo)
	tieringGroup := v1.Group("/audit/stats")
	tieringGroup.Use(authService.JWTMiddleware())
	tieringHandler.RegisterRoutes(tieringGroup)

	// Notification routes
	vapidPub := config.GetEnv("VAPID_PUBLIC_KEY", "")
	if vapidPub == "" {
		pub, priv, err := notification.GenerateVAPIDKeys()
		if err == nil {
			vapidPub = pub
			slog.Warn("VAPID keys not configured — generated ephemeral keys (do not use in production)",
				"VAPID_PUBLIC_KEY", pub, "VAPID_PRIVATE_KEY", priv)
		}
	}
	notifRepo := notification.NewRepository(conn)
	notifHandler := notification.NewHandler(notifRepo, vapidPub)
	notifGroup := v1.Group("/notifications")
	notifGroup.Use(authService.JWTMiddleware())
	notifHandler.RegisterRoutes(notifGroup)

	// Healthcheck monitor routes
	hcRepo := hcpkg.NewRepository(conn)
	hcPoller := hcpkg.NewPoller(hcRepo, nil) // poller in reader is only used for RunCheck (test endpoint)
	hcHandler := hcpkg.NewHandler(hcRepo, hcPoller)
	hcGroup := v1.Group("/monitors")
	hcGroup.Use(authService.JWTMiddleware())
	hcHandler.RegisterRoutes(hcGroup)

	healthHandler := health.NewHealthHandler(conn, "1.0.0", "development")
	healthHandler.RegisterRoutes(r.Group(""))

	r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	r.Static("/app", "./frontend/dist")

	// Serve root-level static files that the browser requests outside /app/
	r.StaticFile("/sw.js", "./frontend/dist/sw.js")
	r.StaticFile("/vite.svg", "./frontend/dist/vite.svg")

	r.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/app/")
	})

	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/v1") || strings.HasPrefix(p, "/docs") || strings.HasPrefix(p, "/health") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.File("./frontend/dist/index.html")
	})

	port := config.GetEnv("API_READER_PORT", "8082")
	slog.Info("Reader server running", "port", port)
	if err := r.Run(":" + port); err != nil {
		slog.Error("Reader server failed", "error", err)
	}
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
