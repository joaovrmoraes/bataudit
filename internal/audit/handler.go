package audit

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler is an HTTP handler that processes audit requests.
type Handler struct {
}

func (h *Handler) Test(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "NOW WORKING!!!",
	})
}
