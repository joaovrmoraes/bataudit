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

// ProjectResolver resolves or auto-creates a project for a given service_name + api_key_id.
type ProjectResolver interface {
	EnsureProject(serviceName, apiKeyID string) (string, error)
}

// QueueHandler extends Handler to include queue processing capabilities
type QueueHandler struct {
	*Handler
	queue           *queue.RedisQueue
	projectResolver ProjectResolver
}

// NewQueueHandler creates a new QueueHandler instance
func NewQueueHandler(repository Repository, queue *queue.RedisQueue, resolver ProjectResolver) *QueueHandler {
	return &QueueHandler{
		Handler:         NewHandler(repository),
		queue:           queue,
		projectResolver: resolver,
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

func (h *QueueHandler) RegisterWriteRoutes(router *gin.RouterGroup) {
	router.POST("", h.Create)
}

func (h *Handler) RegisterReadRoutes(router *gin.RouterGroup) {
	router.GET("", h.List)
	router.GET("/stats", h.Stats)
	router.GET("/sessions", h.Sessions)
	router.GET("/:id", h.Details)
}

// Create godoc
// @Summary      Ingest audit event
// @Description  Receives an audit event from an SDK, validates and queues it for processing. Requires X-API-Key header.
// @Tags         ingest
// @Accept       json
// @Produce      json
// @Param        X-API-Key  header    string  true  "API Key"
// @Param        body       body      Audit   true  "Audit event"
// @Success      202        {object}  map[string]interface{}
// @Failure      400        {object}  map[string]string  "BAT-001: invalid JSON / BAT-002: validation failed"
// @Failure      401        {object}  map[string]string  "Invalid or missing API key"
// @Failure      500        {object}  map[string]string  "BAT-003: queue unavailable"
// @Router       /audit [post]
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

	// Auto-resolve project from service_name
	if h.projectResolver != nil && audit.ProjectID == "" {
		apiKeyID, _ := c.Get("api_key_id")
		keyID, _ := apiKeyID.(string)
		if projectID, err := h.projectResolver.EnsureProject(audit.ServiceName, keyID); err == nil {
			audit.ProjectID = projectID
		}
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

// List godoc
// @Summary      List audit events
// @Description  Returns a paginated list of audit events with optional filters
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        page         query     int     false  "Page number (default: 1)"
// @Param        limit        query     int     false  "Items per page (default: 10)"
// @Param        project_id   query     string  false  "Filter by project ID"
// @Param        service_name query     string  false  "Filter by service name"
// @Param        identifier   query     string  false  "Filter by user/client identifier"
// @Param        method       query     string  false  "Filter by HTTP method (GET, POST, PUT, DELETE, PATCH)"
// @Param        status_code  query     int     false  "Filter by HTTP status code"
// @Param        environment  query     string  false  "Filter by environment (prod, staging, dev)"
// @Param        start_date   query     string  false  "Filter from date (ISO 8601)"
// @Param        end_date     query     string  false  "Filter to date (ISO 8601)"
// @Param        sort_by      query     string  false  "Sort column: timestamp | status_code | response_time (default: timestamp)"
// @Param        sort_order   query     string  false  "Sort direction: asc | desc (default: desc)"
// @Success      200          {object}  map[string]interface{}
// @Failure      500          {object}  map[string]string
// @Router       /audit [get]
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

	filters := ListFilters{
		ProjectID:   c.Query("project_id"),
		ServiceName: c.Query("service_name"),
		Identifier:  c.Query("identifier"),
		Method:      c.Query("method"),
		Environment: c.Query("environment"),
		SortBy:      c.Query("sort_by"),
		SortOrder:   c.Query("sort_order"),
	}

	if sc := c.Query("status_code"); sc != "" {
		fmt.Sscanf(sc, "%d", &filters.StatusCode)
	}

	if sd := c.Query("start_date"); sd != "" {
		if t, err := time.Parse(time.RFC3339, sd); err == nil {
			filters.StartDate = &t
		}
	}
	if ed := c.Query("end_date"); ed != "" {
		if t, err := time.Parse(time.RFC3339, ed); err == nil {
			filters.EndDate = &t
		}
	}

	result, err := h.service.ListAudits(limit, offset, filters)
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

// Sessions godoc
// @Summary      List sessions
// @Description  Returns derived user sessions using a 30-minute inactivity gap algorithm
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        project_id   query     string  false  "Filter by project ID"
// @Param        identifier   query     string  false  "Filter by user/client identifier"
// @Param        service_name query     string  false  "Filter by service name"
// @Param        start_date   query     string  false  "Filter from date (ISO 8601)"
// @Param        end_date     query     string  false  "Filter to date (ISO 8601)"
// @Success      200          {object}  map[string]interface{}
// @Failure      500          {object}  map[string]string
// @Router       /audit/sessions [get]
func (h *Handler) Sessions(c *gin.Context) {
	filters := SessionFilters{
		ProjectID:   c.Query("project_id"),
		Identifier:  c.Query("identifier"),
		ServiceName: c.Query("service_name"),
	}
	if sd := c.Query("start_date"); sd != "" {
		if t, err := time.Parse(time.RFC3339, sd); err == nil {
			filters.StartDate = &t
		}
	}
	if ed := c.Query("end_date"); ed != "" {
		if t, err := time.Parse(time.RFC3339, ed); err == nil {
			filters.EndDate = &t
		}
	}

	sessions, err := h.service.GetSessions(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve sessions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sessions})
}

// Stats godoc
// @Summary      Audit statistics
// @Description  Returns aggregated metrics: totals, error rates, response times (avg + p95), active services, 24h timeline, breakdown by service/status/method
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        project_id  query     string  false  "Filter by project ID (omit for all projects)"
// @Success      200         {object}  AuditStats
// @Failure      500         {object}  map[string]string
// @Router       /audit/stats [get]
func (h *Handler) Stats(c *gin.Context) {
	projectID := c.Query("project_id")
	stats, err := h.service.GetStats(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// Details godoc
// @Summary      Get audit event
// @Description  Returns full details of a single audit event by ID
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Audit event UUID"
// @Success      200  {object}  Audit
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /audit/{id} [get]
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
