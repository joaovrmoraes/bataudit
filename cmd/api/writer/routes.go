package main

import (
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/health"
	"github.com/joaovrmoraes/bataudit/internal/queue"
	"gorm.io/gorm"
)

func registerRoutes(r *gin.Engine, conn *gorm.DB, authService *auth.Service, redisQueue *queue.RedisQueue) {
	v1 := r.Group("/v1")

	// ── Audit write ───────────────────────────────────────────────────────────
	auditGroup := v1.Group("/audit")
	auditGroup.Use(authService.APIKeyMiddleware())
	audit.NewQueueHandler(audit.NewRepository(conn), redisQueue, authService).RegisterWriteRoutes(auditGroup)

	// ── Health probe ──────────────────────────────────────────────────────────
	health.NewHealthHandler(conn, "1.0.0", "development").RegisterRoutes(r.Group(""))
}
