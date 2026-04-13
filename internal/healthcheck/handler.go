package healthcheck

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

const maxMonitorsPerProject = 10

type Handler struct {
	repo   Repository
	poller *Poller
}

func NewHandler(repo Repository, poller *Poller) *Handler {
	return &Handler{repo: repo, poller: poller}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.POST("", h.Create)
	rg.PUT("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
	rg.GET("/:id/history", h.History)
	rg.POST("/:id/test", h.Test)
}

func (h *Handler) List(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id required"})
		return
	}
	monitors, err := h.repo.ListByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": monitors})
}

func (h *Handler) Create(c *gin.Context) {
	var body struct {
		ProjectID       string `json:"project_id" binding:"required"`
		Name            string `json:"name"        binding:"required"`
		URL             string `json:"url"         binding:"required"`
		IntervalSeconds int    `json:"interval_seconds"`
		TimeoutSeconds  int    `json:"timeout_seconds"`
		ExpectedStatus  int    `json:"expected_status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count, err := h.repo.CountByProject(body.ProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if count >= maxMonitorsPerProject {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "maximum of 10 monitors per project"})
		return
	}

	interval := body.IntervalSeconds
	if interval <= 0 {
		interval = 60
	}
	timeout := body.TimeoutSeconds
	if timeout <= 0 {
		timeout = 10
	}
	expected := body.ExpectedStatus
	if expected == 0 {
		expected = 200
	}

	m := &Monitor{
		ProjectID:       body.ProjectID,
		Name:            body.Name,
		URL:             body.URL,
		IntervalSeconds: interval,
		TimeoutSeconds:  timeout,
		ExpectedStatus:  expected,
		Enabled:         true,
		LastStatus:      StatusUnknown,
	}
	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	m, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "monitor not found"})
		return
	}

	var body struct {
		Name            *string `json:"name"`
		URL             *string `json:"url"`
		IntervalSeconds *int    `json:"interval_seconds"`
		TimeoutSeconds  *int    `json:"timeout_seconds"`
		ExpectedStatus  *int    `json:"expected_status"`
		Enabled         *bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.Name != nil {
		m.Name = *body.Name
	}
	if body.URL != nil {
		m.URL = *body.URL
	}
	if body.IntervalSeconds != nil {
		m.IntervalSeconds = *body.IntervalSeconds
	}
	if body.TimeoutSeconds != nil {
		m.TimeoutSeconds = *body.TimeoutSeconds
	}
	if body.ExpectedStatus != nil {
		m.ExpectedStatus = *body.ExpectedStatus
	}
	if body.Enabled != nil {
		m.Enabled = *body.Enabled
	}

	if err := h.repo.Update(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) History(c *gin.Context) {
	id := c.Param("id")
	limit := 50
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	results, err := h.repo.ListResults(id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

func (h *Handler) Test(c *gin.Context) {
	id := c.Param("id")
	result, err := h.poller.RunCheck(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "monitor not found"})
		return
	}
	c.JSON(http.StatusOK, result)
}
