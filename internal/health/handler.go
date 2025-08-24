package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type HealthHandler struct {
	DB          *gorm.DB
	Version     string
	Environment string
}

func NewHealthHandler(db *gorm.DB, version, env string) *HealthHandler {
	return &HealthHandler{DB: db, Version: version, Environment: env}
}

func (h *HealthHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/health", h.Health)
}

func (h *HealthHandler) Health(c *gin.Context) {
	start := time.Now()
	dbStatus := "ok"
	dbDuration := int64(0)

	if h.DB != nil {
		dbStart := time.Now()
		sqlDB, err := h.DB.DB()
		if err != nil {
			dbStatus = "error"
		} else {
			err = sqlDB.Ping()
			if err != nil {
				dbStatus = "error"
			}
		}
		dbDuration = time.Since(dbStart).Milliseconds()
	} else {
		dbStatus = "unavailable"
	}

	apiDuration := time.Since(start).Milliseconds()

	c.JSON(http.StatusOK, gin.H{
		"status":          "ok",
		"message":         "BatAudit API is healthy",
		"api_response_ms": apiDuration,
		"db_status":       dbStatus,
		"db_response_ms":  dbDuration,
		"version":         h.Version,
		"environment":     h.Environment,
	})
}
