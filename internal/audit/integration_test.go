//go:build integration

package audit_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/queue"
	"github.com/joaovrmoraes/bataudit/internal/worker"
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

func testRedisAddr() string {
	if v := os.Getenv("TEST_REDIS_ADDR"); v != "" {
		return v
	}
	return "localhost:6380"
}

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dbURL := testDBURL()
	m, err := migrate.New("file://../../internal/db/migrations", dbURL)
	require.NoError(t, err, "failed to init migrations")
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		require.NoError(t, err, "failed to run migrations")
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "failed to connect to test db")

	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		db.Exec("TRUNCATE TABLE audits, api_keys, project_members, projects, users RESTART IDENTITY CASCADE")
		sqlDB.Close()
	})

	return db
}

// TestCreateAndList verifies that an audit event written directly via the
// repository can be retrieved through the service List method.
func TestCreateAndList(t *testing.T) {
	db := setupTestDB(t)

	repo := audit.NewRepository(db)
	svc := audit.NewService(repo)

	event := &audit.Audit{
		ID:          "550e8400-e29b-41d4-a716-446655440000",
		EventType:   "http",
		ServiceName: "integration-svc",
		Method:      "GET",
		Path:        "/health",
		StatusCode:  200,
		Identifier:  "user-123",
		Environment: "dev",
		Timestamp:   time.Now(),
	}
	require.NoError(t, repo.Create(event))

	result, err := svc.ListAudits(10, 0, audit.ListFilters{ServiceName: "integration-svc"})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.TotalItems)
	assert.Equal(t, "550e8400-e29b-41d4-a716-446655440000", result.Data[0].ID)
}

// TestWorkerFlow exercises the full Writer→Redis→Worker→DB path:
// 1. POST /v1/audit (writer) enqueues the event
// 2. worker.Service dequeues and persists
// 3. GET /v1/audit (reader) returns the persisted event
func TestWorkerFlow(t *testing.T) {
	db := setupTestDB(t)

	// --- Redis ---
	q, err := queue.NewRedisQueue(testRedisAddr(), "bataudit:test:events")
	require.NoError(t, err, "redis must be available for integration test")
	t.Cleanup(func() { q.Close() })

	ctx := context.Background()

	// --- Auth setup ---
	authRepo := auth.NewRepository(db)
	authSvc := auth.NewService(authRepo, "test-jwt-secret")

	owner, err := authSvc.SetupOwner("Test Owner", "owner@test.local", "password123")
	if err != nil && err != auth.ErrOwnerAlreadyExists {
		require.NoError(t, err)
	}
	if owner == nil {
		owner, err = authRepo.GetUserByEmail("owner@test.local")
		require.NoError(t, err)
	}

	project := &auth.Project{
		ID:        "proj-int-test",
		Name:      "Integration Test Project",
		Slug:      "worker-flow-svc", // must match service_name so EnsureProject finds it
		CreatedBy: owner.ID,
		CreatedAt: time.Now(),
	}
	_ = authRepo.CreateProject(project)

	rawKey, err := authSvc.CreateAPIKey(project.ID, "test-key")
	require.NoError(t, err)

	// --- Writer handler ---
	auditRepo := audit.NewRepository(db)
	auditWriter := audit.NewQueueHandler(auditRepo, q, authSvc)

	gin.SetMode(gin.TestMode)
	writerRouter := gin.New()
	writerRouter.Use(authSvc.APIKeyMiddleware())
	writerRouter.POST("/v1/audit", auditWriter.Create)

	// POST an event to the writer
	payload := map[string]interface{}{
		"event_type":   "http",
		"service_name": "worker-flow-svc",
		"method":       "POST",
		"path":         "/login",
		"status_code":  200,
		"identifier":   "user-worker-test",
		"environment":  "dev",
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/v1/audit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rawKey)
	rec := httptest.NewRecorder()
	writerRouter.ServeHTTP(rec, req)
	require.Equal(t, http.StatusAccepted, rec.Code, "writer must accept the event")

	// --- Worker: drain one event ---
	auditSvc := audit.NewService(auditRepo)
	workerSvc := worker.NewService(
		&worker.Config{
			InitialWorkerCount: 1,
			MinWorkerCount:     1,
			MaxWorkerCount:     1,
			QueueName:          "bataudit:test:events",
			PollDuration:       100 * time.Millisecond,
			MaxRetries:         3,
		},
		auditSvc,
		q,
	)

	workerCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	go workerSvc.Start(workerCtx) //nolint:errcheck

	// Wait for the worker to process the event (poll with deadline).
	deadline := time.Now().Add(5 * time.Second)
	var found bool
	for time.Now().Before(deadline) {
		result, _ := auditSvc.ListAudits(10, 0, audit.ListFilters{ServiceName: "worker-flow-svc"})
		if result.TotalItems > 0 {
			found = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	assert.True(t, found, "worker must persist the event to the DB within 5s")
}

// TestRedisUnavailable verifies that the writer returns BAT-003 when Redis is down.
// It reuses the test Redis but closes the connection before sending the request.
func TestRedisUnavailable(t *testing.T) {
	db := setupTestDB(t)

	q, err := queue.NewRedisQueue(testRedisAddr(), "bataudit:test:unavail")
	require.NoError(t, err, "redis must be available to set up this test")
	// Close immediately — subsequent Enqueue calls will fail.
	q.Close()

	authRepo := auth.NewRepository(db)
	authSvc := auth.NewService(authRepo, "test-jwt-secret-2")

	owner, ownerErr := authSvc.SetupOwner("Owner3", "owner3@test.local", "password123")
	if ownerErr == auth.ErrOwnerAlreadyExists {
		owner, ownerErr = authRepo.GetUserByEmail("owner3@test.local")
	}
	require.NoError(t, ownerErr)

	proj := &auth.Project{
		ID:        "proj-bad-redis",
		Name:      "bad-redis",
		Slug:      "bad-redis",
		CreatedBy: owner.ID,
		CreatedAt: time.Now(),
	}
	_ = authRepo.CreateProject(proj)

	rawKey, err := authSvc.CreateAPIKey(proj.ID, "bad-redis-key")
	require.NoError(t, err)

	auditRepo := audit.NewRepository(db)
	handler := audit.NewQueueHandler(auditRepo, q, authSvc)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(authSvc.APIKeyMiddleware())
	r.POST("/v1/audit", handler.Create)

	payload := map[string]interface{}{
		"event_type":   "http",
		"service_name": "bad-redis-svc",
		"method":       "GET",
		"path":         "/test",
		"status_code":  200,
		"identifier":   "user-bad-redis",
		"environment":  "dev",
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/v1/audit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rawKey)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "BAT-003", resp["code"])
}
