package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/db"
)

func main() {
	r := gin.Default()
	conn := db.Init()
	sqlDB, _ := conn.DB()

	defer sqlDB.Close()

	auditGroup := r.Group("/audit")
	{
		handler := audit.NewHandler(conn)
		handler.RegisterRoutes(auditGroup)
	}

	fmt.Println("Servidor iniciando na porta :8080")
	r.Run()
}
