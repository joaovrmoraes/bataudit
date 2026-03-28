//go:build integration

package auth_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	migrate "github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func testDBURL() string {
	if v := os.Getenv("TEST_DB_URL"); v != "" {
		return v
	}
	return "postgres://batuser:batpassword@localhost:5433/batdb_test?sslmode=disable"
}

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dbURL := testDBURL()
	m, err := migrate.New("file://../../internal/db/migrations", dbURL)
	require.NoError(t, err)
	if upErr := m.Up(); upErr != nil && upErr != migrate.ErrNoChange {
		require.NoError(t, upErr)
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		db.Exec("TRUNCATE TABLE users, projects, project_members, api_keys RESTART IDENTITY CASCADE")
		sqlDB.Close()
	})

	return db
}

func protectedRouter(svc *auth.Service) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/protected", svc.JWTMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.POST("/ingest", svc.APIKeyMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

// TestJWTInvalid verifies that a malformed JWT is rejected with 401 and BAT-005.
func TestJWTInvalid(t *testing.T) {
	db := setupTestDB(t)
	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, "real-secret")
	r := protectedRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer this.is.not.a.valid.jwt")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAT-005")
}

// TestAPIKeyExpired verifies that a revoked API key is rejected with 401 and BAT-004.
func TestAPIKeyExpired(t *testing.T) {
	db := setupTestDB(t)
	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, "real-secret")

	owner, err := svc.SetupOwner("Owner", "owner@auth.test", "ownerpass")
	if err == auth.ErrOwnerAlreadyExists {
		owner, err = repo.GetUserByEmail("owner@auth.test")
	}
	require.NoError(t, err)

	proj := &auth.Project{
		ID:        "proj-apikey-test",
		Name:      "API Key Test Project",
		Slug:      "apikey-test-project",
		CreatedBy: owner.ID,
		CreatedAt: time.Now(),
	}
	require.NoError(t, repo.CreateProject(proj))

	rawKey, err := svc.CreateAPIKey(proj.ID, "revoke-me")
	require.NoError(t, err)

	keys, err := repo.ListAPIKeysByProject(proj.ID)
	require.NoError(t, err)
	require.Len(t, keys, 1)
	require.NoError(t, repo.RevokeAPIKey(keys[0].ID))

	r := protectedRouter(svc)
	req := httptest.NewRequest(http.MethodPost, "/ingest", nil)
	req.Header.Set("X-API-Key", rawKey)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAT-004")
}

// TestRoleInsufficient verifies that a viewer JWT is rejected by an owner-only endpoint.
func TestRoleInsufficient(t *testing.T) {
	db := setupTestDB(t)
	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, "real-secret")

	// Need at least one user so SetupOwner's countUsers > 0 guard is satisfied
	// for subsequent users. Create the owner first, then insert a viewer.
	_, err := svc.SetupOwner("Owner", "owner@role.test", "ownerpass")
	if err != nil && err != auth.ErrOwnerAlreadyExists {
		require.NoError(t, err)
	}

	// bcrypt hash of "viewerpass" (cost 10) — pre-computed to avoid test latency.
	const viewerPassHash = "$2a$10$V90PElS1SSL.r.QJ.sUAuOOWnm.Zujn36feR74Gw0qdn.SD0xdynK"
	viewer := &auth.User{
		ID:           "viewer-role-test",
		Name:         "Viewer",
		Email:        "viewer@role.test",
		PasswordHash: viewerPassHash,
		Role:         auth.RoleViewer,
		CreatedAt:    time.Now(),
	}
	require.NoError(t, repo.CreateUser(viewer))

	token, _, err := svc.Login("viewer@role.test", "viewerpass")
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/owner-only",
		svc.JWTMiddleware(),
		requireRole(auth.RoleOwner),
		func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) },
	)

	req := httptest.NewRequest(http.MethodGet, "/owner-only", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

// requireRole is a minimal role-checking middleware used only in integration tests.
func requireRole(required auth.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		if auth.UserRole(c.GetString(auth.ContextKeyUserRole)) != required {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "insufficient role",
				"code":  "BAT-006",
			})
			return
		}
		c.Next()
	}
}
