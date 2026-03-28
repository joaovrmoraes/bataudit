package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const ContextKeyClaims = "claims"
const ContextKeyUserID = "user_id"
const ContextKeyUserRole = "user_role"
const ContextKeyProjectID = "project_id"

// JWTMiddleware validates the Bearer token and sets user claims in context.
func (s *Service) JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing or invalid Authorization header",
				"code":  "BAT-005",
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := s.ValidateToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired token",
				"code":  "BAT-005",
			})
			return
		}

		c.Set(ContextKeyClaims, claims)
		c.Set(ContextKeyUserID, claims.UserID)
		c.Set(ContextKeyUserRole, string(claims.Role))
		c.Next()
	}
}

// APIKeyMiddleware validates the X-API-Key header and sets project_id in context.
func (s *Service) APIKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		rawKey := c.GetHeader("X-API-Key")
		if rawKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing X-API-Key header",
				"code":  "BAT-004",
			})
			return
		}

		key, err := s.ValidateAPIKey(rawKey)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired API key",
				"code":  "BAT-004",
			})
			return
		}

		c.Set(ContextKeyProjectID, key.ProjectID)
		c.Set("api_key_id", key.ID)
		c.Next()
	}
}
