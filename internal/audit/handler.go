package audit

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	validator  *validator.Validate
	repository Repository
	service    *Service
}

func NewHandler(repository Repository) *Handler {
	return &Handler{
		validator:  validator.New(),
		repository: repository,
		service:    NewService(repository),
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("", h.Create)
	router.GET("", h.List)
	router.GET("/:id", h.Details)
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

	// Process the audit record asynchronously usando Service
	go func(audit Audit) {
		maxRetries := 3
		for i := 0; i < maxRetries; i++ {
			err := h.service.CreateAudit(audit)

			if err != nil {
				fmt.Println("Failed to save audit record:", err)
				time.Sleep(2 * time.Second) // Await 2 seconds before retrying
			} else {
				break // Success, exit the loop
			}
		}
	}(audit)
}

func (h *Handler) List(c *gin.Context) {
	limit := 10
	page := 1

	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * limit

	result, err := h.service.ListAudits(limit, offset)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to retrieve audit records",
			"details": err.Error(),
		})
		return
	}

	totalPages := (result.TotalItems + int64(limit) - 1) / int64(limit)

	c.JSON(http.StatusOK, gin.H{
		"data": result.Data,
		"pagination": gin.H{
			"page":       page,
			"totalPage":  totalPages,
			"limit":      limit,
			"totalItems": result.TotalItems,
		},
	})
}

func (h *Handler) Details(c *gin.Context) {
	id := c.Param("id")
	audit, err := h.service.GetAuditByID(id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Audit record not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to retrieve audit record",
				"details": err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, audit)
}
