package main

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/anomaly"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/health"
	hcpkg "github.com/joaovrmoraes/bataudit/internal/healthcheck"
	"github.com/joaovrmoraes/bataudit/internal/notification"
	"github.com/joaovrmoraes/bataudit/internal/tiering"
	"github.com/joaovrmoraes/bataudit/internal/wallboard"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/gorm"
)

func registerRoutes(r *gin.Engine, conn *gorm.DB, authService *auth.Service) {
	v1 := r.Group("/v1")

	// ── Auth ─────────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authService)
	authHandler.RegisterPublicRoutes(v1.Group("/auth"))
	protectedAuth := v1.Group("/auth")
	protectedAuth.Use(authService.JWTMiddleware())
	authHandler.RegisterProtectedRoutes(protectedAuth)

	// ── Audit ─────────────────────────────────────────────────────────────────
	auditGroup := v1.Group("/audit")
	auditGroup.Use(authService.JWTMiddleware())
	auditHandler := audit.NewHandler(audit.NewRepository(conn))
	auditHandler.RegisterReadRoutes(auditGroup)

	// ── Anomaly ───────────────────────────────────────────────────────────────
	anomalyGroup := v1.Group("/anomaly")
	anomalyGroup.Use(authService.JWTMiddleware())
	anomaly.NewHandler(anomaly.NewRepository(conn)).RegisterRoutes(anomalyGroup)

	// ── Tiering ───────────────────────────────────────────────────────────────
	tieringGroup := v1.Group("/audit/stats")
	tieringGroup.Use(authService.JWTMiddleware())
	tiering.NewHandler(tiering.NewRepository(conn)).RegisterRoutes(tieringGroup)

	// ── Notifications ─────────────────────────────────────────────────────────
	vapidPub := config.GetEnv("VAPID_PUBLIC_KEY", "")
	if vapidPub == "" {
		pub, _, err := notification.GenerateVAPIDKeys()
		if err == nil {
			vapidPub = pub
			slog.Warn("VAPID_PUBLIC_KEY not set — using ephemeral key (push subscriptions will reset on restart)")
		} else {
			slog.Warn("VAPID_PUBLIC_KEY not set and key generation failed — push notifications unavailable", "error", err)
		}
	}
	notifGroup := v1.Group("/notifications")
	notifGroup.Use(authService.JWTMiddleware())
	notification.NewHandler(notification.NewRepository(conn), vapidPub).RegisterRoutes(notifGroup)

	// ── Healthcheck monitors ──────────────────────────────────────────────────
	hcRepo := hcpkg.NewRepository(conn)
	hcPoller := hcpkg.NewPoller(hcRepo, nil) // poller here only serves RunCheck (test endpoint)
	hcGroup := v1.Group("/monitors")
	hcGroup.Use(authService.JWTMiddleware())
	hcpkg.NewHandler(hcRepo, hcPoller).RegisterRoutes(hcGroup)

	// ── Wallboard ─────────────────────────────────────────────────────────────
	jwtSecret := config.GetEnv("JWT_SECRET", "change-me-in-production")
	wbHandler := wallboard.NewHandler(wallboard.NewRepository(conn), jwtSecret)
	wbHandler.RegisterPublicRoutes(v1.Group("/wallboard"))
	wbHandler.RegisterDataRoutes(v1.Group("/wallboard"))
	wbManage := v1.Group("/wallboard")
	wbManage.Use(authService.JWTMiddleware())
	wbHandler.RegisterManagementRoutes(wbManage)

	// ── Health probe ──────────────────────────────────────────────────────────
	health.NewHealthHandler(conn, "1.0.0", "development").RegisterRoutes(r.Group(""))

	// ── Docs ──────────────────────────────────────────────────────────────────
	r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// ── Static / SPA ──────────────────────────────────────────────────────────
	r.Static("/app", "./frontend/dist")
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
}
