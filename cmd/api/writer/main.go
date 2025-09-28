package main

import (
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/health"
	"github.com/joaovrmoraes/bataudit/internal/queue"
)

func main() {
	r := gin.Default()
	r.Use(cors.Default())

	conn := db.Init()
	sqlDB, _ := conn.DB()

	defer sqlDB.Close()

	redisQueue, err := queue.NewRedisQueue("localhost:6379", queue.DefaultQueueName)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisQueue.Close()

	auditGroup := r.Group("/audit")
	{
		repository := audit.NewRepository(conn)

		handler := audit.NewQueueHandler(repository, redisQueue)
		handler.RegisterWriteRoutes(auditGroup)
	}

	handler := health.NewHealthHandler(conn, "1.0.0", "development")
	handler.RegisterRoutes(r.Group(""))

	fmt.Println("Writer server running on:8081")
	r.Run(":8081")
}
