package anomaly

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joaovrmoraes/bataudit/internal/auth"
)

// Handler exposes the anomaly rules API.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes mounts the anomaly endpoints under the provided router group.
// Expected: the group is already JWT-protected.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/rules", h.ListRules)
	rg.POST("/rules", h.CreateRule)
	rg.DELETE("/rules/:id", h.DeleteRule)
}

// ListRules godoc
// @Summary      List anomaly rules for a project
// @Tags         anomaly
// @Produce      json
// @Param        project_id  query  string  true  "Project ID"
// @Success      200  {array}  AnomalyRule
// @Router       /anomaly/rules [get]
func (h *Handler) ListRules(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id required"})
		return
	}

	rules, err := h.repo.ListByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rules)
}

type createRuleRequest struct {
	ProjectID     string   `json:"project_id" binding:"required"`
	RuleType      RuleType `json:"rule_type"  binding:"required"`
	Threshold     float64  `json:"threshold"  binding:"required"`
	WindowSeconds int      `json:"window_seconds"`
}

// CreateRule godoc
// @Summary      Create an anomaly rule
// @Tags         anomaly
// @Accept       json
// @Produce      json
// @Param        body  body  createRuleRequest  true  "Rule"
// @Success      201  {object}  AnomalyRule
// @Router       /anomaly/rules [post]
func (h *Handler) CreateRule(c *gin.Context) {
	claims, ok := c.MustGet("claims").(*auth.Claims)
	if !ok || (claims.Role != auth.RoleOwner && claims.Role != auth.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	var req createRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule := &AnomalyRule{
		ID:            uuid.New().String(),
		ProjectID:     req.ProjectID,
		RuleType:      req.RuleType,
		Threshold:     req.Threshold,
		WindowSeconds: req.WindowSeconds,
		Active:        true,
		CreatedAt:     time.Now(),
	}

	if err := h.repo.Create(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// DeleteRule godoc
// @Summary      Deactivate an anomaly rule
// @Tags         anomaly
// @Param        id  path  string  true  "Rule ID"
// @Success      204
// @Router       /anomaly/rules/{id} [delete]
func (h *Handler) DeleteRule(c *gin.Context) {
	claims, ok := c.MustGet("claims").(*auth.Claims)
	if !ok || (claims.Role != auth.RoleOwner && claims.Role != auth.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	id := c.Param("id")
	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
