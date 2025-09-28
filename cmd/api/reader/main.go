package main

import (
	"fmt"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/health"
)

func main() {
	r := gin.Default()
	r.Use(cors.Default())

	conn := db.Init()
	sqlDB, _ := conn.DB()

	defer sqlDB.Close()

	auditGroup := r.Group("/audit")
	{
		handler := audit.NewHandler(audit.NewRepository(conn))
		handler.RegisterReadRoutes(auditGroup)
	}

	handler := health.NewHealthHandler(conn, "1.0.0", "development")
	handler.RegisterRoutes(r.Group(""))

	r.Static("/app", "./frontend/dist")

	port := config.GetEnv("API_READER_PORT", "8082")
	fmt.Printf("Reader server running on port %s\n", port)
	r.Run(":" + port)
}
