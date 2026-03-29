// seed-anomalies inserts event bursts that trigger every anomaly rule type
// and the corresponding system.alert events directly into the database.
// Use this to pre-populate the Anomalies tab without waiting for live traffic.
//
// Usage:
//
//	go run ./cmd/tools/seed-anomalies
package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
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

	authRepo := auth.NewRepository(conn)

	// Resolve project.
	project, err := authRepo.GetProjectBySlug("demo")
	if err == auth.ErrNotFound {
		slog.Error("demo project not found — run seed first")
		os.Exit(1)
	}
	if err != nil {
		slog.Error("failed to look up demo project", "error", err)
		os.Exit(1)
	}
	slog.Info("found project", "id", project.ID, "name", project.Name)
	_ = ownerEmail

	// Ensure anomaly rules exist.
	anomalyRepo := anomaly.NewRepository(conn)
	rules, err := anomalyRepo.ListByProject(project.ID)
	if err != nil || len(rules) == 0 {
		slog.Info("seeding default anomaly rules")
		if createErr := anomalyRepo.CreateDefaultRules(project.ID); createErr != nil {
			slog.Error("failed to create anomaly rules", "error", createErr)
			os.Exit(1)
		}
	} else {
		slog.Info("anomaly rules already exist", "count", len(rules))
	}

	repo := audit.NewRepository(conn)
	now := time.Now()
	total := 0
	alerts := 0

	// ── 1. Brute Force ────────────────────────────────────────────────────────
	// 15 × 401/403 from same identifier within 5 minutes → triggers brute_force (threshold 10)
	slog.Info("seeding brute_force scenario")
	bruteStart := now.Add(-25 * time.Minute)
	for i := range 15 {
		e := audit.Audit{
			ID:          uuid.New().String(),
			EventType:   "http",
			Method:      "POST",
			Path:        "/v1/auth/login",
			StatusCode:  401,
			ResponseTime: 85,
			Identifier:  "attacker_001",
			UserEmail:   "attacker@unknown.net",
			UserName:    "Unknown",
			ServiceName: "api-gateway",
			Environment: "production",
			Timestamp:   bruteStart.Add(time.Duration(i*15) * time.Second),
			ProjectID:   project.ID,
			RequestID:   fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
			IP:          "203.0.113.99",
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += createAlert(repo, project.ID, "api-gateway", "production", anomaly.RuleBruteForce,
		map[string]any{
			"identifier":  "attacker_001",
			"count":       15,
			"window_secs": 300,
			"threshold":   10,
		},
		bruteStart.Add(4*time.Minute),
	)

	// ── 2. Error Rate ─────────────────────────────────────────────────────────
	// 50 requests in 5 min, 15 errors (30% > 20% threshold) → triggers error_rate
	slog.Info("seeding error_rate scenario")
	errStart := now.Add(-18 * time.Minute)
	for i := range 50 {
		statusCode := 200
		if i < 15 {
			statusCode = map[int]int{0: 500, 1: 502, 2: 503, 3: 400, 4: 422}[i%5]
		}
		e := audit.Audit{
			ID:           uuid.New().String(),
			EventType:    "http",
			Method:       "GET",
			Path:         "/v1/payments",
			StatusCode:   statusCode,
			ResponseTime: int64(50 + i*10),
			Identifier:   fmt.Sprintf("usr_%03d", (i%5)+1),
			ServiceName:  "payments-service",
			Environment:  "production",
			Timestamp:    errStart.Add(time.Duration(i*6) * time.Second),
			ProjectID:    project.ID,
			RequestID:    fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += createAlert(repo, project.ID, "payments-service", "production", anomaly.RuleErrorRate,
		map[string]any{
			"error_rate":  30.0,
			"threshold":   20.0,
			"errors":      15,
			"total":       50,
			"window_secs": 300,
		},
		errStart.Add(5*time.Minute),
	)

	// ── 3. Mass Delete ────────────────────────────────────────────────────────
	// 60 DELETE requests in 5 min → triggers mass_delete (threshold 50)
	slog.Info("seeding mass_delete scenario")
	deleteStart := now.Add(-10 * time.Minute)
	for i := range 60 {
		e := audit.Audit{
			ID:           uuid.New().String(),
			EventType:    "http",
			Method:       "DELETE",
			Path:         "/v1/items/" + uuid.New().String()[:8],
			StatusCode:   204,
			ResponseTime: 45,
			Identifier:   "svc_001",
			UserEmail:    "service-account@internal",
			UserName:     "Internal Service",
			ServiceName:  "inventory-service",
			Environment:  "production",
			Timestamp:    deleteStart.Add(time.Duration(i*4) * time.Second),
			ProjectID:    project.ID,
			RequestID:    fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		}
		if err := repo.Create(&e); err == nil {
			total++
		}
	}
	alerts += createAlert(repo, project.ID, "inventory-service", "production", anomaly.RuleMassDelete,
		map[string]any{
			"count":       60,
			"threshold":   50,
			"window_secs": 300,
		},
		deleteStart.Add(4*time.Minute),
	)

	// ── 4. Volume Spike ───────────────────────────────────────────────────────
	// Insert normal baseline (5 events/min for 59 min) then a 60-event burst in 1 min.
	// The detector uses z-score; we just insert the alert directly here.
	slog.Info("seeding volume_spike scenario (alert only)")
	alerts += createAlert(repo, project.ID, "api-gateway", "production", anomaly.RuleVolumeSpike,
		map[string]any{
			"current_rate":  60,
			"baseline_mean": 5.1,
			"baseline_std":  1.2,
			"z_score":       45.75,
			"threshold":     3.0,
			"window_secs":   60,
		},
		now.Add(-5*time.Minute),
	)

	// ── 5. Silent Service ─────────────────────────────────────────────────────
	// Insert one old event for "legacy-service", then the silent_service alert.
	slog.Info("seeding silent_service scenario")
	oldEvent := audit.Audit{
		ID:          uuid.New().String(),
		EventType:   "http",
		Method:      "GET",
		Path:        "/v1/health",
		StatusCode:  200,
		ResponseTime: 12,
		Identifier:  "svc_monitor",
		ServiceName: "legacy-service",
		Environment: "production",
		Timestamp:   now.Add(-45 * time.Minute), // last event was 45 min ago
		ProjectID:   project.ID,
		RequestID:   fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
	}
	if err := repo.Create(&oldEvent); err == nil {
		total++
	}
	alerts += createAlert(repo, project.ID, "legacy-service", "production", anomaly.RuleSilentService,
		map[string]any{
			"last_event_at":    now.Add(-45 * time.Minute).Format(time.RFC3339),
			"silence_minutes":  45,
			"threshold_minutes": 15,
		},
		now.Add(-2*time.Minute),
	)

	slog.Info("anomaly seed complete",
		"trigger_events_inserted", total,
		"alerts_inserted", alerts,
	)
}

// createAlert inserts a system.alert event directly into the audit table,
// mimicking what the worker would generate after detecting an anomaly.
func createAlert(
	repo audit.Repository,
	projectID, serviceName, environment string,
	ruleType anomaly.RuleType,
	details map[string]any,
	ts time.Time,
) int {
	payload, _ := json.Marshal(details)
	event := audit.Audit{
		ID:          uuid.New().String(),
		EventType:   "system.alert",
		Path:        string(ruleType),
		Identifier:  "system",
		ServiceName: serviceName,
		Environment: environment,
		ProjectID:   projectID,
		Timestamp:   ts,
		RequestBody: datatypes.JSON(payload),
	}
	if err := repo.Create(&event); err != nil {
		slog.Error("failed to insert alert", "rule", ruleType, "error", err)
		return 0
	}
	slog.Info("alert inserted", "rule", ruleType, "service", serviceName)
	return 1
}

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
