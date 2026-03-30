// Seed creates a demo owner, project, API key, and realistic audit events.
// Designed to run once inside docker-compose.demo.yml; exits 0 on success.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joaovrmoraes/bataudit/internal/anomaly"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/auth"
	"github.com/joaovrmoraes/bataudit/internal/config"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	conn := connectWithRetry()
	defer func() {
		if sqlDB, err := conn.DB(); err == nil {
			sqlDB.Close()
		}
	}()

	ownerEmail := config.GetEnv("INITIAL_OWNER_EMAIL", "demo@bataudit.dev")
	ownerPassword := config.GetEnv("INITIAL_OWNER_PASSWORD", "demo")
	ownerName := config.GetEnv("INITIAL_OWNER_NAME", "Demo User")

	authRepo := auth.NewRepository(conn)
	authSvc := auth.NewService(authRepo, "demo-secret")

	// Create owner (idempotent).
	owner, err := authSvc.SetupOwner(ownerName, ownerEmail, ownerPassword)
	if err != nil && err != auth.ErrOwnerAlreadyExists {
		slog.Error("failed to create demo owner", "error", err)
		os.Exit(1)
	}
	if owner != nil {
		slog.Info("demo owner created", "email", ownerEmail)
	} else {
		slog.Info("demo owner already exists, skipping")
		// Fetch existing owner for project linking.
		owner, _ = authRepo.GetUserByEmail(ownerEmail)
	}

	// Create demo project (idempotent via slug).
	project, err := authRepo.GetProjectBySlug("demo")
	if err == auth.ErrNotFound {
		project = &auth.Project{
			ID:        uuid.New().String(),
			Name:      "Demo Project",
			Slug:      "demo",
			CreatedAt: time.Now(),
		}
		if owner != nil {
			project.CreatedBy = owner.ID
		}
		if createErr := authRepo.CreateProject(project); createErr != nil {
			slog.Error("failed to create demo project", "error", createErr)
			os.Exit(1)
		}
		slog.Info("demo project created", "id", project.ID)

		// Seed default anomaly rules for the project.
		anomalyRepo := anomaly.NewRepository(conn)
		_ = anomalyRepo.CreateDefaultRules(project.ID)
	} else if err != nil {
		slog.Error("failed to look up demo project", "error", err)
		os.Exit(1)
	} else {
		slog.Info("demo project already exists, skipping project creation")
	}

	// Ensure a known demo API key exists (for seed-stream).
	ensureDemoAPIKey(authRepo, project.ID)

	// Check if events already seeded (avoid duplicate seeds).
	var count int64
	conn.Model(&audit.Audit{}).Where("project_id = ?", project.ID).Count(&count)
	if count > 100 {
		slog.Info("demo data already seeded", "events", count)
		return
	}

	// Seed audit events.
	total := seedEvents(conn, project.ID)
	slog.Info("seed complete", "events_inserted", total, "project_id", project.ID)

	// Seed anomaly scenarios (idempotent).
	seedAnomalies(conn, project.ID)
}

func seedAnomalies(conn *gorm.DB, projectID string) {
	// Skip if alerts already exist.
	var count int64
	conn.Model(&audit.Audit{}).Where("project_id = ? AND event_type = 'system.alert'", projectID).Count(&count)
	if count > 0 {
		slog.Info("anomaly data already seeded", "alerts", count)
		return
	}

	repo := audit.NewRepository(conn)
	now := time.Now()
	total := 0
	alerts := 0

	// Brute force: 15 × 401 from same identifier in 5 min
	bruteStart := now.Add(-25 * time.Minute)
	for i := range 15 {
		e := audit.Audit{
			ID: uuid.New().String(), EventType: "http", Method: "POST",
			Path: "/v1/auth/login", StatusCode: 401, ResponseTime: 85,
			Identifier: "attacker_001", UserEmail: "attacker@unknown.net",
			ServiceName: "api-gateway", Environment: "production",
			Timestamp: bruteStart.Add(time.Duration(i*15) * time.Second),
			ProjectID: projectID, RequestID: fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
			IP: "203.0.113.99",
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += insertAlert(repo, projectID, "api-gateway", "production", anomaly.RuleBruteForce,
		map[string]any{"identifier": "attacker_001", "count": 15, "window_secs": 300, "threshold": 10},
		bruteStart.Add(4*time.Minute))

	// Error rate: 50 requests, 15 errors (30% > 20% threshold)
	errStart := now.Add(-18 * time.Minute)
	for i := range 50 {
		status := 200
		if i < 15 {
			status = map[int]int{0: 500, 1: 502, 2: 503, 3: 400, 4: 422}[i%5]
		}
		e := audit.Audit{
			ID: uuid.New().String(), EventType: "http", Method: "GET",
			Path: "/v1/payments", StatusCode: status, ResponseTime: int64(50 + i*10),
			Identifier: fmt.Sprintf("usr_%03d", (i%5)+1), ServiceName: "payments-service",
			Environment: "production", Timestamp: errStart.Add(time.Duration(i*6) * time.Second),
			ProjectID: projectID, RequestID: fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += insertAlert(repo, projectID, "payments-service", "production", anomaly.RuleErrorRate,
		map[string]any{"error_rate": 30.0, "threshold": 20.0, "errors": 15, "total": 50, "window_secs": 300},
		errStart.Add(5*time.Minute))

	// Mass delete: 60 DELETE requests in 5 min
	deleteStart := now.Add(-10 * time.Minute)
	for i := range 60 {
		e := audit.Audit{
			ID: uuid.New().String(), EventType: "http", Method: "DELETE",
			Path: "/v1/items/" + uuid.New().String()[:8], StatusCode: 204, ResponseTime: 45,
			Identifier: "svc_001", UserEmail: "service-account@internal",
			ServiceName: "inventory-service", Environment: "production",
			Timestamp: deleteStart.Add(time.Duration(i*4) * time.Second),
			ProjectID: projectID, RequestID: fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += insertAlert(repo, projectID, "inventory-service", "production", anomaly.RuleMassDelete,
		map[string]any{"count": 60, "threshold": 50, "window_secs": 300},
		deleteStart.Add(4*time.Minute))

	// Volume spike (alert only)
	alerts += insertAlert(repo, projectID, "api-gateway", "production", anomaly.RuleVolumeSpike,
		map[string]any{"current_rate": 60, "baseline_mean": 5.1, "z_score": 45.75, "threshold": 3.0},
		now.Add(-5*time.Minute))

	// Silent service
	oldEvent := audit.Audit{
		ID: uuid.New().String(), EventType: "http", Method: "GET", Path: "/v1/health",
		StatusCode: 200, ResponseTime: 12, Identifier: "svc_monitor",
		ServiceName: "legacy-service", Environment: "production",
		Timestamp: now.Add(-45 * time.Minute), ProjectID: projectID,
		RequestID: fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
	}
	if err := repo.Create(&oldEvent); err == nil {
		total++
	}
	alerts += insertAlert(repo, projectID, "legacy-service", "production", anomaly.RuleSilentService,
		map[string]any{"silence_minutes": 45, "threshold_minutes": 15, "last_event_at": now.Add(-45 * time.Minute).Format(time.RFC3339)},
		now.Add(-2*time.Minute))

	slog.Info("anomaly seed complete", "events", total, "alerts", alerts)
}

func insertAlert(repo audit.Repository, projectID, serviceName, environment string, ruleType anomaly.RuleType, details map[string]any, ts time.Time) int {
	payload, _ := json.Marshal(details)
	event := audit.Audit{
		ID: uuid.New().String(), EventType: "system.alert",
		Path: string(ruleType), Identifier: "system",
		ServiceName: serviceName, Environment: environment,
		ProjectID: projectID, Timestamp: ts,
		RequestBody: datatypes.JSON(payload),
	}
	if err := repo.Create(&event); err != nil {
		slog.Warn("failed to insert alert", "rule", ruleType, "error", err)
		return 0
	}
	return 1
}

// ensureDemoAPIKey creates a fixed API key from DEMO_API_KEY env var (idempotent).
// This allows seed-stream to use the key without needing to discover it at runtime.
func ensureDemoAPIKey(repo auth.Repository, projectID string) {
	rawKey := config.GetEnv("DEMO_API_KEY", "")
	if rawKey == "" {
		return
	}

	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	// Idempotent: skip if key already exists.
	if _, err := repo.GetAPIKeyByHash(keyHash); err == nil {
		slog.Info("demo API key already exists")
		return
	}

	key := &auth.APIKey{
		ID:        uuid.New().String(),
		KeyHash:   keyHash,
		ProjectID: projectID,
		Name:      "Demo Streamer Key",
		CreatedAt: time.Now(),
		Active:    true,
	}
	if err := repo.CreateAPIKey(key); err != nil {
		slog.Warn("failed to create demo API key", "error", err)
		return
	}
	slog.Info("demo API key created", "key", rawKey)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func connectWithRetry() *gorm.DB {
	for attempt := range 30 {
		conn, err := db.Init()
		if err == nil {
			return conn
		}
		slog.Warn("db not ready, retrying...", "attempt", attempt+1, "error", err)
		time.Sleep(3 * time.Second)
	}
	slog.Error("could not connect to database after 30 attempts")
	os.Exit(1)
	return nil
}

// ── seed data ─────────────────────────────────────────────────────────────────

var services = []struct {
	name  string
	paths []string
}{
	{"api-gateway", []string{"/v1/users", "/v1/users/{id}", "/v1/auth/login", "/v1/auth/logout", "/v1/products", "/v1/orders", "/v1/health"}},
	{"payments-service", []string{"/v1/payments", "/v1/payments/{id}", "/v1/refunds", "/v1/invoices", "/v1/subscriptions"}},
	{"notification-service", []string{"/v1/notifications/send", "/v1/notifications/{id}", "/v1/templates", "/v1/email/send"}},
	{"inventory-service", []string{"/v1/items", "/v1/items/{id}", "/v1/stock", "/v1/warehouses", "/v1/purchase-orders"}},
}

var demoUsers = []struct {
	id    string
	email string
	name  string
}{
	{"usr_001", "alice@acme.com", "Alice Silva"},
	{"usr_002", "bob@acme.com", "Bob Santos"},
	{"usr_003", "carol@acme.com", "Carol Lima"},
	{"usr_004", "dave@partner.io", "Dave Costa"},
	{"usr_005", "eve@partner.io", "Eve Oliveira"},
	{"svc_001", "service-account@internal", "Internal Service"},
}

var methods = []string{"GET", "POST", "PUT", "PATCH", "DELETE"}
var methodWeights = []int{50, 25, 10, 8, 7}
var statusCodes = []struct {
	code, weight int
}{
	{200, 55}, {201, 15}, {204, 5},
	{400, 8}, {401, 4}, {403, 3}, {404, 6}, {422, 2},
	{500, 1}, {502, 1},
}
var ips = []string{"203.0.113.10", "198.51.100.42", "192.0.2.100", "10.0.0.5", "172.16.0.25"}
var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
	"okhttp/4.9.3", "axios/1.4.0", "python-requests/2.28.0", "Go-http-client/1.1",
}

const batchSize = 50

func seedEvents(conn *gorm.DB, projectID string) int {
	now := time.Now()
	total := 0

	// Historical events — batched per day with a small pause between days.
	for dayIdx := range 30 {
		dayStart := now.AddDate(0, 0, -dayIdx).Truncate(24 * time.Hour)
		isWeekend := dayStart.Weekday() == time.Saturday || dayStart.Weekday() == time.Sunday
		count := randBetween(40, 80)
		if !isWeekend {
			count = randBetween(80, 150)
		}
		isSpike := dayIdx == 7 || dayIdx == 20

		batch := make([]audit.Audit, 0, count)
		for range count {
			batch = append(batch, generateEvent(dayStart, isSpike, projectID))
		}
		if res := conn.CreateInBatches(batch, batchSize); res.Error == nil {
			total += len(batch)
		}
		time.Sleep(80 * time.Millisecond) // throttle: ~12 days/s instead of flat-out
	}

	// Dense session burst (last 2 hours) for alice.
	burstStart := now.Add(-2 * time.Hour)
	burst := make([]audit.Audit, 40)
	for i := range 40 {
		e := generateEvent(burstStart, false, projectID)
		e.Identifier = "usr_001"
		e.UserEmail = "alice@acme.com"
		e.UserName = "Alice Silva"
		e.ServiceName = "api-gateway"
		e.Environment = "production"
		e.Timestamp = burstStart.Add(time.Duration(i) * 3 * time.Minute)
		burst[i] = e
	}
	if res := conn.CreateInBatches(burst, batchSize); res.Error == nil {
		total += len(burst)
	}

	// Orphan events — browser-side events with no matching backend audit.
	var orphans []audit.Audit
	for i := range 12 {
		requestID := fmt.Sprintf("bat-%s", uuid.New().String()[:8])
		svc := services[rand.Intn(len(services))]
		user := demoUsers[rand.Intn(len(demoUsers))]
		ts := now.Add(-time.Duration(rand.Intn(24)) * time.Hour).Add(-time.Duration(rand.Intn(60)) * time.Minute)
		orphan := audit.Audit{
			ID:          uuid.New().String(),
			EventType:   "http",
			Method:      audit.HTTPMethod(randChoice([]string{"GET", "POST", "PUT"})),
			Path:        svc.paths[rand.Intn(len(svc.paths))],
			StatusCode:  0,
			Identifier:  user.id,
			UserEmail:   user.email,
			UserName:    user.name,
			UserAgent:   randChoice(userAgents),
			RequestID:   requestID,
			Source:      "browser",
			ServiceName: svc.name,
			Environment: "production",
			Timestamp:   ts,
			ProjectID:   projectID,
			ErrorMessage: randChoice([]string{
				"request timed out", "connection refused", "network error",
				"fetch failed", "ERR_CONNECTION_RESET",
			}),
		}
		if i%3 == 0 {
			backend := orphan
			backend.ID = uuid.New().String()
			backend.Source = "backend"
			backend.StatusCode = 200
			backend.ResponseTime = int64(randBetween(50, 300))
			backend.ErrorMessage = ""
			orphans = append(orphans, backend)
		}
		orphans = append(orphans, orphan)
	}
	if res := conn.CreateInBatches(orphans, batchSize); res.Error == nil {
		total += len(orphans)
	}

	return total
}

func generateEvent(dayStart time.Time, isSpike bool, projectID string) audit.Audit {
	svc := services[rand.Intn(len(services))]
	user := demoUsers[rand.Intn(len(demoUsers))]
	method := weightedPick(methods, methodWeights)
	statusCode := weightedStatus(isSpike)
	responseTime := responseTimeFor(statusCode)
	hour := businessHour()
	ts := dayStart.Add(time.Duration(hour)*time.Hour +
		time.Duration(rand.Intn(60))*time.Minute +
		time.Duration(rand.Intn(60))*time.Second)

	var errMsg string
	if statusCode >= 500 {
		errMsg = randChoice([]string{
			"internal server error", "database connection timeout",
			"upstream service unavailable",
		})
	}

	env := "production"
	if n := rand.Intn(100); n >= 70 && n < 90 {
		env = "staging"
	} else if n >= 90 {
		env = "development"
	}

	return audit.Audit{
		ID:           uuid.New().String(),
		EventType:    "http",
		Method:       audit.HTTPMethod(method),
		Path:         svc.paths[rand.Intn(len(svc.paths))],
		StatusCode:   statusCode,
		ResponseTime: int64(responseTime),
		Identifier:   user.id,
		UserEmail:    user.email,
		UserName:     user.name,
		UserRoles:    []byte(`["viewer"]`),
		IP:           randChoice(ips),
		UserAgent:    randChoice(userAgents),
		RequestID:    fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		ServiceName:  svc.name,
		Environment:  env,
		Timestamp:    ts,
		ErrorMessage: errMsg,
		ProjectID:    projectID,
	}
}

func weightedPick(items []string, weights []int) string {
	n := rand.Intn(100)
	sum := 0
	for i, w := range weights {
		sum += w
		if n < sum {
			return items[i]
		}
	}
	return items[0]
}

func weightedStatus(spike bool) int {
	if spike && rand.Intn(100) < 30 {
		return randChoice([]int{500, 502, 503})
	}
	n := rand.Intn(100)
	sum := 0
	for _, s := range statusCodes {
		sum += s.weight
		if n < sum {
			return s.code
		}
	}
	return 200
}

func responseTimeFor(status int) int {
	if status >= 500 {
		return randBetween(1000, 10000)
	}
	if status >= 400 {
		return randBetween(50, 500)
	}
	if rand.Intn(100) < 5 {
		return randBetween(500, 3000)
	}
	return randBetween(5, 250)
}

func businessHour() int {
	if rand.Intn(100) < 70 {
		return 9 + rand.Intn(10)
	}
	return rand.Intn(24)
}

func randBetween(min, max int) int { return min + rand.Intn(max-min+1) }

func randChoice[T any](s []T) T { return s[rand.Intn(len(s))] }
