package notification

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/auth"
)

// Handler exposes the notifications API.
type Handler struct {
	repo      Repository
	vapidPub  string
}

func NewHandler(repo Repository, vapidPub string) *Handler {
	return &Handler{repo: repo, vapidPub: vapidPub}
}

// RegisterRoutes mounts all notification endpoints.
// Expected: router group is already JWT-protected.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	push := rg.Group("/push")
	push.GET("/vapid-public-key", h.VAPIDPublicKey)
	push.POST("/subscribe", h.Subscribe)
	push.DELETE("/subscribe", h.Unsubscribe)

	wh := rg.Group("/webhooks")
	wh.GET("", h.ListWebhooks)
	wh.POST("", h.CreateWebhook)
	wh.DELETE("/:id", h.DeleteWebhook)
	wh.POST("/:id/test", h.TestWebhook)
	wh.GET("/:id/deliveries", h.ListDeliveries)
}

// VAPIDPublicKey returns the VAPID public key for the frontend to use when subscribing.
func (h *Handler) VAPIDPublicKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"public_key": h.vapidPub})
}

// Subscribe saves a browser push subscription for the given project.
func (h *Handler) Subscribe(c *gin.Context) {
	var body struct {
		ProjectID    string          `json:"project_id" binding:"required"`
		Subscription json.RawMessage `json:"subscription" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch := &Channel{
		ProjectID: body.ProjectID,
		Type:      ChannelPush,
		Config:    body.Subscription,
		Active:    true,
		CreatedAt: time.Now(),
	}
	if err := h.repo.CreateChannel(ch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

// Unsubscribe removes a push subscription by channel ID.
func (h *Handler) Unsubscribe(c *gin.Context) {
	claims := mustClaims(c)
	if claims == nil {
		return
	}

	var body struct {
		ProjectID string `json:"project_id" binding:"required"`
		ChannelID string `json:"channel_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.DeleteChannel(body.ChannelID, body.ProjectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListWebhooks returns all active webhook channels for a project.
func (h *Handler) ListWebhooks(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id required"})
		return
	}

	channels, err := h.repo.ListChannels(projectID, ChannelWebhook)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Mask webhook secrets before returning
	masked := make([]gin.H, 0, len(channels))
	for _, ch := range channels {
		var cfg WebhookConfig
		_ = json.Unmarshal(ch.Config, &cfg)
		if cfg.Secret != "" {
			cfg.Secret = "••••••••"
		}
		cfgJSON, _ := json.Marshal(cfg)
		masked = append(masked, gin.H{
			"id":         ch.ID,
			"project_id": ch.ProjectID,
			"type":       ch.Type,
			"config":     json.RawMessage(cfgJSON),
			"active":     ch.Active,
			"created_at": ch.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, masked)
}

// CreateWebhook registers a new webhook channel.
func (h *Handler) CreateWebhook(c *gin.Context) {
	claims := mustClaims(c)
	if claims == nil {
		return
	}
	if claims.Role != auth.RoleOwner && claims.Role != auth.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	var body struct {
		ProjectID string `json:"project_id" binding:"required"`
		URL       string `json:"url"        binding:"required"`
		Secret    string `json:"secret"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg, _ := json.Marshal(WebhookConfig{URL: body.URL, Secret: body.Secret})

	ch := &Channel{
		ProjectID: body.ProjectID,
		Type:      ChannelWebhook,
		Config:    cfg,
		Active:    true,
		CreatedAt: time.Now(),
	}
	if err := h.repo.CreateChannel(ch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

// DeleteWebhook deactivates a webhook channel.
func (h *Handler) DeleteWebhook(c *gin.Context) {
	claims := mustClaims(c)
	if claims == nil {
		return
	}
	if claims.Role != auth.RoleOwner && claims.Role != auth.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	projectID := c.Query("project_id")
	if err := h.repo.DeleteChannel(c.Param("id"), projectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// TestWebhook fires a test payload to the configured webhook URL.
func (h *Handler) TestWebhook(c *gin.Context) {
	claims := mustClaims(c)
	if claims == nil {
		return
	}

	projectID := c.Query("project_id")
	channels, err := h.repo.ListChannels(projectID, ChannelWebhook)
	if err != nil || len(channels) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "webhook not found"})
		return
	}

	id := c.Param("id")
	var target *Channel
	for i := range channels {
		if channels[i].ID == id {
			target = &channels[i]
			break
		}
	}
	if target == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "webhook not found"})
		return
	}

	sender := NewSender(h.repo, "", "", "")
	code, body, err := sender.sendWebhook(c.Request.Context(), *target, AlertPayload{
		EventID:     "test",
		ProjectID:   projectID,
		ServiceName: "test-service",
		RuleType:    "test",
		Timestamp:   time.Now(),
		Details:     map[string]any{"message": "This is a test notification from BatAudit"},
	})

	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status_code": code, "response": body})
}

// ListDeliveries returns the last 50 delivery attempts for a webhook.
func (h *Handler) ListDeliveries(c *gin.Context) {
	deliveries, err := h.repo.ListDeliveries(c.Param("id"), 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, deliveries)
}

func mustClaims(c *gin.Context) *auth.Claims {
	claims, ok := c.MustGet("claims").(*auth.Claims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil
	}
	return claims
}
