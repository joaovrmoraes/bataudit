package audit

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type Handler struct {
	validator *validator.Validate
}

func NewHandler() *Handler {
	return &Handler{
		validator: validator.New(),
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("", h.Create)
}

func (h *Handler) Create(c *gin.Context) {
	var audit Audit

	if err := c.ShouldBindJSON(&audit); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid JSON format",
			"details": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(&audit); err != nil {
		var validationErrors []string
		for _, err := range err.(validator.ValidationErrors) {
			validationErrors = append(validationErrors, err.Field()+" is "+err.Tag())
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": validationErrors,
		})
		return
	}

	// TODO: Implement audit creation logic here
	c.JSON(http.StatusCreated, gin.H{
		"message": "Audit created successfully",
		"audit":   audit,
	})
}
