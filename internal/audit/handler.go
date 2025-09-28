package audit

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/joaovrmoraes/bataudit/internal/queue"
	"gorm.io/gorm"
)

type Handler struct {
	validator  *validator.Validate
	repository Repository
	service    *Service
}

// QueueHandler extends Handler to include queue processing capabilities
type QueueHandler struct {
	*Handler
	queue *queue.RedisQueue
}

// NewQueueHandler creates a new QueueHandler instance
func NewQueueHandler(repository Repository, queue *queue.RedisQueue) *QueueHandler {
	return &QueueHandler{
		Handler: NewHandler(repository),
		queue:   queue,
	}
}

func NewHandler(repository Repository) *Handler {
	v := validator.New()

	RegisterCustomValidations(v)

	return &Handler{
		validator:  v,
		repository: repository,
		service:    NewService(repository),
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("", h.List)
	router.GET("/:id", h.Details)
}

func (h *QueueHandler) RegisterWriteRoutes(router *gin.RouterGroup) {
	router.POST("", h.Create)
}

func (h *Handler) RegisterReadRoutes(router *gin.RouterGroup) {
	router.GET("", h.List)
	router.GET("/:id", h.Details)
}

func (h *QueueHandler) Create(c *gin.Context) {
	var audit Audit

	if err := c.ShouldBindJSON(&audit); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid JSON format",
			"details": err.Error(),
			"status":  "failed",
			"code":    "BAT-001",
		})
		return
	}

	if audit.Timestamp.IsZero() {
		audit.Timestamp = time.Now()
	}

	SanitizeAudit(&audit)

	if DetectSensitiveData(&audit) {
		MaskSensitiveData(&audit)
	}

	if err := h.validator.Struct(&audit); err != nil {
		var validationErrors []map[string]string

		for _, err := range err.(validator.ValidationErrors) {
			fieldErr := map[string]string{
				"field":   err.Field(),
				"value":   fmt.Sprintf("%v", err.Value()),
				"tag":     err.Tag(),
				"param":   err.Param(),
				"message": FormatValidationError(err),
			}
			validationErrors = append(validationErrors, fieldErr)
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "Validation failed",
			"validation": validationErrors,
			"status":     "failed",
			"code":       "BAT-002",
		})
		return
	}

	if audit.ID == "" {
		audit.ID = uuid.New().String()
	}

	if audit.RequestID == "" {
		audit.RequestID = fmt.Sprintf("bat-%s", uuid.New().String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := h.queue.Enqueue(ctx, audit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to queue audit event",
			"details": err.Error(),
			"status":  "failed",
			"code":    "BAT-003",
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"message":    "Audit received and will be processed",
		"status":     "success",
		"audit_id":   audit.ID,
		"request_id": audit.RequestID,
		"timestamp":  audit.Timestamp,
	})
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
