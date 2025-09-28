package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"github.com/joaovrmoraes/bataudit/internal/health"
	"github.com/joaovrmoraes/bataudit/internal/queue"
	"gorm.io/gorm"
)

func main() {
	r := gin.Default()
	r.Use(cors.Default())

	maxRetries := 5
	var conn *gorm.DB
	var err error

	for i := 0; i < maxRetries; i++ {
		fmt.Printf("Tentando conectar ao banco de dados (tentativa %d de %d)...\n", i+1, maxRetries)
		conn = db.Init()
		if conn != nil {
			fmt.Println("Conexão com o banco de dados estabelecida com sucesso!")
			break
		}
		if i < maxRetries-1 {
			fmt.Println("Falha na conexão, tentando novamente em 5 segundos...")
			time.Sleep(5 * time.Second)
		}
	}

	if conn == nil {
		log.Fatalf("Não foi possível conectar ao banco de dados após %d tentativas", maxRetries)
	}

	sqlDB, _ := conn.DB()
	defer sqlDB.Close()

	redisAddress := config.GetEnv("REDIS_ADDRESS", "localhost:6379")
	fmt.Printf("Conectando ao Redis em: %s\n", redisAddress)

	var redisQueue *queue.RedisQueue
	for i := 0; i < maxRetries; i++ {
		fmt.Printf("Tentando conectar ao Redis (tentativa %d de %d)...\n", i+1, maxRetries)
		redisQueue, err = queue.NewRedisQueue(redisAddress, queue.DefaultQueueName)
		if err == nil {
			fmt.Println("Conexão com Redis estabelecida com sucesso!")
			break
		}
		fmt.Printf("Falha na conexão com Redis: %v\n", err)
		if i < maxRetries-1 {
			fmt.Println("Tentando novamente em 5 segundos...")
			time.Sleep(5 * time.Second)
		}
	}

	if redisQueue == nil {
		log.Fatalf("Failed to connect to Redis after %d attempts", maxRetries)
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

	port := config.GetEnv("API_WRITER_PORT", "8081")
	fmt.Printf("Writer server running on port %s\n", port)
	r.Run(":" + port)
}
