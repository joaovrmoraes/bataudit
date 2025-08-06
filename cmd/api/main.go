package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
)

func main() {
	r := gin.Default()

	auditGroup := r.Group("/audit")
	{
		handler := audit.NewHandler()
		handler.RegisterRoutes(auditGroup)
	}

	fmt.Println("Servidor iniciando na porta :8080")
	r.Run()
}
