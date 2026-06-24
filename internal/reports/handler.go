package reports

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.POST("", h.Create)
	rg.PUT("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
}

func canWrite(c *gin.Context) bool {
	role := c.GetString("user_role")
	return role == "owner" || role == "admin"
}

func (h *Handler) List(c *gin.Context) {
	items, err := h.repo.List(c.Query("project_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Get(c *gin.Context) {
	r, err := h.repo.Get(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}
	c.JSON(http.StatusOK, r)
}

type reportBody struct {
	ProjectID string         `json:"project_id"`
	Name      string         `json:"name" binding:"required"`
	Widgets   datatypes.JSON `json:"widgets"`
	Layout    datatypes.JSON `json:"layout"`
}

func (h *Handler) Create(c *gin.Context) {
	if !canWrite(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner or admin only"})
		return
	}
	var body reportBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now().UTC()
	r := &Report{
		ID:        uuid.NewString(),
		ProjectID: body.ProjectID,
		Name:      body.Name,
		Widgets:   defaultJSON(body.Widgets),
		Layout:    defaultJSON(body.Layout),
		CreatedBy: c.GetString("user_id"),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := h.repo.Create(r); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, r)
}

func (h *Handler) Update(c *gin.Context) {
	if !canWrite(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner or admin only"})
		return
	}
	var body reportBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	r := &Report{
		ID:        c.Param("id"),
		Name:      body.Name,
		Widgets:   defaultJSON(body.Widgets),
		Layout:    defaultJSON(body.Layout),
		UpdatedAt: time.Now().UTC(),
	}
	if err := h.repo.Update(r); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

func (h *Handler) Delete(c *gin.Context) {
	if !canWrite(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner or admin only"})
		return
	}
	if err := h.repo.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// defaultJSON ensures a non-null JSON value (empty array) is stored.
func defaultJSON(j datatypes.JSON) datatypes.JSON {
	if len(j) == 0 {
		return datatypes.JSON([]byte("[]"))
	}
	return j
}
