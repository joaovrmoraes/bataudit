package wallboard

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	GenerateToken(projectID, name string) (*Token, string, error) // returns token + raw refresh token
	ListTokens(projectID string) ([]Token, error)
	GetByCode(code string) (*Token, error)
	GetByRefreshHash(hash string) (*Token, error)
	RenewExpiry(id string, expiresAt time.Time) error
	UpdateRefreshHash(id, hash string) error
	TouchLastUsed(id string) error
	DeleteByID(id string) error

	GetSummary(projectID string) (*Summary, error)
	GetFeed(projectID string, limit int) ([]FeedEvent, error)
	GetVolume(projectID string) ([]VolumePoint, error)
	GetHealth(projectID string) ([]HealthEntry, error)
	GetAlerts(projectID string) ([]AlertEntry, error)
	GetErrorRoutes(projectID string) ([]ErrorRoute, error)
	GetProjects() ([]Project, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ── Token management ─────────────────────────────────────────────────────────

func generateCode() string {
	b := make([]byte, 3)
	rand.Read(b) //nolint:errcheck
	return fmt.Sprintf("BAT-%s", strings.ToUpper(hex.EncodeToString(b)))
}

func (r *repository) GenerateToken(projectID, name string) (*Token, string, error) {
	// Generate raw refresh token
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, "", err
	}
	rawRefresh := hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(rawRefresh))
	refreshHash := hex.EncodeToString(hash[:])

	tok := &Token{
		ID:          uuid.New().String(),
		Name:        name,
		ProjectID:   projectID,
		Code:        generateCode(),
		RefreshHash: refreshHash,
		ExpiresAt:   time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:   time.Now(),
	}

	if err := r.db.Create(tok).Error; err != nil {
		return nil, "", err
	}

	return tok, rawRefresh, nil
}

func (r *repository) ListTokens(projectID string) ([]Token, error) {
	var tokens []Token
	q := r.db.Model(&Token{}).Order("created_at DESC")
	if projectID != "" {
		q = q.Where("project_id = ?", projectID)
	}
	if err := q.Find(&tokens).Error; err != nil {
		return nil, err
	}
	return tokens, nil
}

func (r *repository) GetByCode(code string) (*Token, error) {
	var tok Token
	if err := r.db.Where("code = ? AND expires_at > NOW()", code).First(&tok).Error; err != nil {
		return nil, err
	}
	return &tok, nil
}

func (r *repository) GetByRefreshHash(hash string) (*Token, error) {
	var tok Token
	if err := r.db.Where("refresh_hash = ? AND expires_at > NOW()", hash).First(&tok).Error; err != nil {
		return nil, err
	}
	return &tok, nil
}

func (r *repository) RenewExpiry(id string, expiresAt time.Time) error {
	return r.db.Model(&Token{}).Where("id = ?", id).Update("expires_at", expiresAt).Error
}

func (r *repository) UpdateRefreshHash(id, hash string) error {
	return r.db.Model(&Token{}).Where("id = ?", id).Update("refresh_hash", hash).Error
}

func (r *repository) TouchLastUsed(id string) error {
	now := time.Now()
	return r.db.Model(&Token{}).Where("id = ?", id).Update("last_used_at", now).Error
}

func (r *repository) DeleteByID(id string) error {
	return r.db.Where("id = ?", id).Delete(&Token{}).Error
}

// ── Data queries ──────────────────────────────────────────────────────────────

func projectFilter(db *gorm.DB, projectID string) *gorm.DB {
	if projectID != "" {
		return db.Where("project_id = ?", projectID)
	}
	return db
}

func (r *repository) GetSummary(projectID string) (*Summary, error) {
	var s Summary
	q := projectFilter(r.db.Table("audits"), projectID).
		Where("timestamp >= NOW() - INTERVAL '24 hours'").
		Select(`
			COUNT(*) AS events_today,
			COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) AS errors_4xx,
			COUNT(CASE WHEN status_code >= 500 THEN 1 END) AS errors_5xx,
			COALESCE(AVG(response_time), 0) AS avg_response_ms,
			COUNT(DISTINCT service_name) AS active_services
		`)
	if err := q.Scan(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *repository) GetFeed(projectID string, limit int) ([]FeedEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var events []FeedEvent
	q := projectFilter(r.db.Table("audits"), projectID).
		Where("event_type != 'system.alert' OR event_type IS NULL").
		Select(`method, path, status_code, response_time AS response_ms, service_name, TO_CHAR(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp`).
		Order("timestamp DESC").
		Limit(limit)
	if err := q.Scan(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

func (r *repository) GetVolume(projectID string) ([]VolumePoint, error) {
	var points []VolumePoint
	q := projectFilter(r.db.Table("audits"), projectID).
		Where("timestamp >= NOW() - INTERVAL '2 hours'").
		Select(`TO_CHAR((DATE_TRUNC('minute', timestamp) - (EXTRACT(MINUTE FROM timestamp)::int % 5) * INTERVAL '1 minute') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS bucket, COUNT(*) AS count`).
		Group("bucket").
		Order("bucket ASC")
	if err := q.Scan(&points).Error; err != nil {
		return nil, err
	}
	return points, nil
}

func (r *repository) GetHealth(projectID string) ([]HealthEntry, error) {
	var entries []HealthEntry
	q := r.db.Table("healthcheck_monitors").
		Select("name, url, last_status, 0 AS response_ms").
		Where("enabled = true")
	if projectID != "" {
		q = q.Where("project_id = ?", projectID)
	}

	// Get latest response_ms from results
	type row struct {
		Name        string
		URL         string
		LastStatus  string
		ResponseMs  int64
		LastChecked string
	}
	var rows []row
	healthQuery := `
		SELECT m.name, m.url, m.last_status,
			COALESCE((SELECT response_ms FROM healthcheck_results r WHERE r.monitor_id = m.id ORDER BY r.checked_at DESC LIMIT 1), 0) AS response_ms,
			COALESCE((SELECT TO_CHAR(r.checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM healthcheck_results r WHERE r.monitor_id = m.id ORDER BY r.checked_at DESC LIMIT 1), '') AS last_checked
		FROM healthcheck_monitors m
		WHERE m.enabled = true`
	healthArgs := []interface{}{}
	if projectID != "" {
		healthQuery += " AND m.project_id = ?"
		healthArgs = append(healthArgs, projectID)
	}
	healthQuery += " ORDER BY CASE m.last_status WHEN 'DOWN' THEN 0 ELSE 1 END, m.name ASC"
	r.db.Raw(healthQuery, healthArgs...).Scan(&rows)

	for _, row := range rows {
		entries = append(entries, HealthEntry{
			Name:        row.Name,
			URL:         row.URL,
			LastStatus:  row.LastStatus,
			ResponseMs:  row.ResponseMs,
			LastChecked: row.LastChecked,
		})
	}
	_ = q // suppress unused warning
	return entries, nil
}

func (r *repository) GetAlerts(projectID string) ([]AlertEntry, error) {
	var alerts []AlertEntry
	q := projectFilter(r.db.Table("audits"), projectID).
		Where("event_type = 'system.alert'").
		Where("timestamp >= NOW() - INTERVAL '30 minutes'").
		Select(`path AS rule_type, service_name, environment, TO_CHAR(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp`).
		Order("timestamp DESC").
		Limit(20)
	if err := q.Scan(&alerts).Error; err != nil {
		return nil, err
	}
	return alerts, nil
}

func (r *repository) GetProjects() ([]Project, error) {
	var projects []Project
	if err := r.db.Table("projects").Select("id, name").Order("name ASC").Scan(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *repository) GetErrorRoutes(projectID string) ([]ErrorRoute, error) {
	var routes []ErrorRoute
	q := projectFilter(r.db.Table("audits"), projectID).
		Where("timestamp >= NOW() - INTERVAL '1 hour'").
		Select(`path, method, COUNT(CASE WHEN status_code >= 400 THEN 1 END) AS error_count, COUNT(*) AS total`).
		Group("path, method").
		Having("COUNT(CASE WHEN status_code >= 400 THEN 1 END) > 0").
		Order("error_count DESC").
		Limit(10)

	type raw struct {
		Path       string
		Method     string
		ErrorCount int64
		Total      int64
	}
	var rows []raw
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		rate := 0.0
		if row.Total > 0 {
			rate = float64(row.ErrorCount) / float64(row.Total) * 100
		}
		routes = append(routes, ErrorRoute{
			Path:       row.Path,
			Method:     row.Method,
			ErrorCount: row.ErrorCount,
			ErrorRate:  rate,
		})
	}
	return routes, nil
}
