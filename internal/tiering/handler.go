package tiering

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes mounts tiering endpoints onto an already-JWT-protected group.
// Expected base path: /v1/audit/stats
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/history", h.History)
	rg.GET("/usage", h.Usage)
}

// History godoc
// @Summary      Audit event history (time series)
// @Description  Returns hourly/daily time series merging raw events and pre-aggregated summaries.
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        project_id  query  string  true   "Project ID"
// @Param        start_date  query  string  false  "ISO 8601 start (default: 90 days ago)"
// @Param        end_date    query  string  false  "ISO 8601 end (default: now)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /audit/stats/history [get]
func (h *Handler) History(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id required"})
		return
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -90) // default: last 90 days

	if sd := c.Query("start_date"); sd != "" {
		if t, err := time.Parse(time.RFC3339, sd); err == nil {
			from = t.UTC()
		}
	}
	if ed := c.Query("end_date"); ed != "" {
		if t, err := time.Parse(time.RFC3339, ed); err == nil {
			to = t.UTC()
		}
	}

	points, err := h.repo.GetHistory(projectID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": points, "from": from, "to": to})
}

// Usage godoc
// @Summary      Data usage stats for a project
// @Description  Returns row counts across raw events and aggregated summaries.
// @Tags         audit
// @Produce      json
// @Security     BearerAuth
// @Param        project_id  query  string  true  "Project ID"
// @Success      200  {object}  UsageStat
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /audit/stats/usage [get]
func (h *Handler) Usage(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id required"})
		return
	}

	stat, err := h.repo.GetUsage(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stat)
}
