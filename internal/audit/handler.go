package audit

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	validator *validator.Validate
	db        *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		validator: validator.New(),
		db:        db,
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

	if audit.ID == "" {
		audit.ID = uuid.New().String()
	}

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Audit received and will be processed",
	})

	// Process the audit record asynchronously
	go func(audit Audit) {
		if err := h.db.Create(&audit).Error; err != nil {
			fmt.Println("Failed to save audit record:", err)
		}
	}(audit)
}
