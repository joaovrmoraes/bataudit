package wallboard

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	accessTokenTTL  = time.Hour
	refreshTokenTTL = 30 * 24 * time.Hour
	ctxProjectID    = "wallboard_project_id"
)

type Handler struct {
	repo      Repository
	jwtSecret []byte
}

func NewHandler(repo Repository, jwtSecret string) *Handler {
	return &Handler{repo: repo, jwtSecret: []byte(jwtSecret)}
}

// RegisterPublicRoutes — code activation + token refresh (no auth required)
func (h *Handler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.POST("/activate", h.Activate)
	r.POST("/refresh", h.Refresh)
}

// RegisterDataRoutes — data endpoints protected by wallboard JWT
func (h *Handler) RegisterDataRoutes(r *gin.RouterGroup) {
	r.Use(h.Middleware())
	r.GET("/summary", h.Summary)
	r.GET("/feed", h.Feed)
	r.GET("/volume", h.Volume)
	r.GET("/health", h.Health)
	r.GET("/alerts", h.Alerts)
	r.GET("/error-routes", h.ErrorRoutes)
	r.GET("/projects", h.Projects)
}

// RegisterManagementRoutes — generate/revoke code (protected by regular JWT)
func (h *Handler) RegisterManagementRoutes(r *gin.RouterGroup) {
	r.GET("/tokens", h.ListCodes)
	r.POST("/token", h.GenerateCode)
	r.DELETE("/token", h.RevokeCode)
}

// ── Management ────────────────────────────────────────────────────────────────

type generateRequest struct {
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
}

func (h *Handler) ListCodes(c *gin.Context) {
	projectID := c.Query("project_id")
	tokens, err := h.repo.ListTokens(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tokens"})
		return
	}
	type item struct {
		ID         string     `json:"id"`
		Name       string     `json:"name"`
		Code       string     `json:"code"`
		ProjectID  string     `json:"project_id"`
		ExpiresAt  time.Time  `json:"expires_at"`
		CreatedAt  time.Time  `json:"created_at"`
		LastUsedAt *time.Time `json:"last_used_at"`
	}
	out := make([]item, len(tokens))
	for i, t := range tokens {
		out[i] = item{ID: t.ID, Name: t.Name, Code: t.Code, ProjectID: t.ProjectID, ExpiresAt: t.ExpiresAt, CreatedAt: t.CreatedAt, LastUsedAt: t.LastUsedAt}
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *Handler) GenerateCode(c *gin.Context) {
	var req generateRequest
	c.ShouldBindJSON(&req) //nolint:errcheck

	tok, _, err := h.repo.GenerateToken(req.ProjectID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         tok.ID,
		"name":       tok.Name,
		"code":       tok.Code,
		"project_id": tok.ProjectID,
		"expires_at": tok.ExpiresAt,
	})
}

func (h *Handler) RevokeCode(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if err := h.repo.DeleteByID(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "revoked"})
}

// ── Auth ──────────────────────────────────────────────────────────────────────

type activateRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *Handler) Activate(c *gin.Context) {
	var req activateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code required"})
		return
	}

	tok, err := h.repo.GetByCode(strings.ToUpper(strings.TrimSpace(req.Code)))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired code"})
		return
	}

	rawRefresh, refreshHash, err := newRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	newExpiry := time.Now().Add(refreshTokenTTL)
	if err := h.repo.RenewExpiry(tok.ID, newExpiry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to renew token"})
		return
	}
	// Store new refresh hash
	if err := h.repo.UpdateRefreshHash(tok.ID, refreshHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update token"})
		return
	}

	accessToken, err := h.signAccessToken(tok.ProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign access token"})
		return
	}

	h.repo.TouchLastUsed(tok.ID) //nolint:errcheck

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": rawRefresh,
		"project_id":    tok.ProjectID,
		"profile_name":  tok.Name,
		"expires_in":    int(accessTokenTTL.Seconds()),
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token required"})
		return
	}

	sum := sha256.Sum256([]byte(req.RefreshToken))
	hashStr := hex.EncodeToString(sum[:])

	tok, err := h.repo.GetByRefreshHash(hashStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	// Sliding window — renew expiry on every refresh
	h.repo.RenewExpiry(tok.ID, time.Now().Add(refreshTokenTTL)) //nolint:errcheck
	h.repo.TouchLastUsed(tok.ID)                                 //nolint:errcheck

	accessToken, err := h.signAccessToken(tok.ProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign access token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"project_id":   tok.ProjectID,
		"expires_in":   int(accessTokenTTL.Seconds()),
	})
}

// ── Middleware ────────────────────────────────────────────────────────────────

func (h *Handler) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return h.jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		if scope, _ := claims["scope"].(string); scope != "wallboard" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid token scope"})
			return
		}

		projectID, _ := claims["project_id"].(string)
		c.Set(ctxProjectID, projectID)
		c.Next()
	}
}

// ── Data endpoints ────────────────────────────────────────────────────────────

func projectFromCtx(c *gin.Context) string {
	if p := c.Query("project_id"); p != "" {
		return p
	}
	pid, _ := c.Get(ctxProjectID)
	s, _ := pid.(string)
	return s
}

func (h *Handler) Summary(c *gin.Context) {
	s, err := h.repo.GetSummary(projectFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch summary"})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) Feed(c *gin.Context) {
	events, err := h.repo.GetFeed(projectFromCtx(c), 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch feed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": events})
}

func (h *Handler) Volume(c *gin.Context) {
	points, err := h.repo.GetVolume(projectFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch volume"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": points})
}

func (h *Handler) Health(c *gin.Context) {
	entries, err := h.repo.GetHealth(projectFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch health"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": entries})
}

func (h *Handler) Alerts(c *gin.Context) {
	alerts, err := h.repo.GetAlerts(projectFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch alerts"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": alerts})
}

func (h *Handler) ErrorRoutes(c *gin.Context) {
	routes, err := h.repo.GetErrorRoutes(projectFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch error routes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": routes})
}

func (h *Handler) Projects(c *gin.Context) {
	projects, err := h.repo.GetProjects()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch projects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": projects})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func newRefreshToken() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	raw = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return
}

func (h *Handler) signAccessToken(projectID string) (string, error) {
	claims := jwt.MapClaims{
		"scope":      "wallboard",
		"project_id": projectID,
		"exp":        time.Now().Add(accessTokenTTL).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(h.jwtSecret)
}
