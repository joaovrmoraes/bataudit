package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
)

func main() {
	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Hello, World!",
		})
	})

	r.GET("/audit/test", func(c *gin.Context) {
		fmt.Println("Rota /audit/test chamada")
		handler := audit.Handler{}
		handler.Test(c)
	})

	fmt.Println("Servidor iniciando na porta :8080")
	r.Run()
}
