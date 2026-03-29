package audit

import (
	"time"

	"gorm.io/gorm"
)

type ListResult struct {
	Data       []AuditSummary
	TotalItems int64
}

type ListFilters struct {
	ProjectID   string
	ServiceName string
	Identifier  string
	Method      string
	StatusCode  int
	Environment string
	EventType   string // http | system.alert
	StartDate   *time.Time
	EndDate     *time.Time
	SortBy      string // timestamp | status_code | response_time
	SortOrder   string // asc | desc
}

type Repository interface {
	Create(audit *Audit) error
	List(limit, offset int, filters ListFilters) (ListResult, error)
	Export(filters ListFilters, maxRows int) ([]AuditSummary, error)
	GetByID(id string) (*Audit, error)
	GetStats(projectID string) (*AuditStats, error)
	GetSessions(filters SessionFilters) ([]Session, error)
	GetSessionByID(sessionID string) (*SessionDetail, error)
	GetOrphans(filters OrphanFilters) ([]AuditSummary, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(audit *Audit) error {
	db := r.db
	if audit.ProjectID == "" {
		db = db.Omit("ProjectID")
	}
	return db.Create(audit).Error
}

func (r *repository) List(limit, offset int, filters ListFilters) (ListResult, error) {
	var audits []AuditSummary
	var totalItems int64

	query := r.db.Model(&Audit{})

	if filters.ProjectID != "" {
		query = query.Where("project_id = ?", filters.ProjectID)
	}
	if filters.ServiceName != "" {
		query = query.Where("service_name = ?", filters.ServiceName)
	}
	if filters.Identifier != "" {
		query = query.Where("identifier = ?", filters.Identifier)
	}
	if filters.Method != "" {
		query = query.Where("method = ?", filters.Method)
	}
	if filters.StatusCode != 0 {
		query = query.Where("status_code = ?", filters.StatusCode)
	}
	if filters.Environment != "" {
		query = query.Where("environment = ?", filters.Environment)
	}
	if filters.EventType != "" {
		query = query.Where("event_type = ?", filters.EventType)
	}
	if filters.StartDate != nil {
		query = query.Where("timestamp >= ?", filters.StartDate)
	}
	if filters.EndDate != nil {
		query = query.Where("timestamp <= ?", filters.EndDate)
	}

	if err := query.Count(&totalItems).Error; err != nil {
		return ListResult{}, err
	}

	allowedSortCols := map[string]bool{"timestamp": true, "status_code": true, "response_time": true}
	sortCol := "timestamp"
	if allowedSortCols[filters.SortBy] {
		sortCol = filters.SortBy
	}
	sortOrder := "desc"
	if filters.SortOrder == "asc" {
		sortOrder = "asc"
	}

	err := query.
		Select("id, event_type, identifier, user_email, user_name, method, path, status_code, service_name, timestamp, response_time").
		Order(sortCol + " " + sortOrder).
		Limit(limit).
		Offset(offset).
		Find(&audits).Error
	if err != nil {
		return ListResult{}, err
	}

	return ListResult{
		Data:       audits,
		TotalItems: totalItems,
	}, nil
}

func (r *repository) Export(filters ListFilters, maxRows int) ([]AuditSummary, error) {
	var audits []AuditSummary

	query := r.db.Model(&Audit{})

	if filters.ProjectID != "" {
		query = query.Where("project_id = ?", filters.ProjectID)
	}
	if filters.ServiceName != "" {
		query = query.Where("service_name = ?", filters.ServiceName)
	}
	if filters.Identifier != "" {
		query = query.Where("identifier = ?", filters.Identifier)
	}
	if filters.Method != "" {
		query = query.Where("method = ?", filters.Method)
	}
	if filters.StatusCode != 0 {
		query = query.Where("status_code = ?", filters.StatusCode)
	}
	if filters.Environment != "" {
		query = query.Where("environment = ?", filters.Environment)
	}
	if filters.EventType != "" {
		query = query.Where("event_type = ?", filters.EventType)
	}
	if filters.StartDate != nil {
		query = query.Where("timestamp >= ?", filters.StartDate)
	}
	if filters.EndDate != nil {
		query = query.Where("timestamp <= ?", filters.EndDate)
	}

	err := query.
		Select("id, event_type, identifier, user_email, user_name, method, path, status_code, service_name, timestamp, response_time").
		Order("timestamp desc").
		Limit(maxRows).
		Find(&audits).Error
	return audits, err
}

func (r *repository) GetByID(id string) (*Audit, error) {
	var audit Audit
	if err := r.db.First(&audit, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &audit, nil
}

func (r *repository) GetSessions(filters SessionFilters) ([]Session, error) {
	// Uses a gap-based session detection: a new session starts when
	// the gap between consecutive events exceeds 30 minutes.
	// We achieve this in PostgreSQL using LAG() window function.
	where := "1=1"
	args := []interface{}{}

	if filters.ProjectID != "" {
		where += " AND project_id = ?"
		args = append(args, filters.ProjectID)
	}
	if filters.Identifier != "" {
		where += " AND identifier = ?"
		args = append(args, filters.Identifier)
	}
	if filters.ServiceName != "" {
		where += " AND service_name = ?"
		args = append(args, filters.ServiceName)
	}
	if filters.StartDate != nil {
		where += " AND timestamp >= ?"
		args = append(args, filters.StartDate)
	}
	if filters.EndDate != nil {
		where += " AND timestamp <= ?"
		args = append(args, filters.EndDate)
	}

	query := `
		WITH ranked AS (
			SELECT
				identifier,
				service_name,
				timestamp,
				LAG(timestamp) OVER (PARTITION BY identifier, service_name ORDER BY timestamp) AS prev_ts
			FROM audits
			WHERE ` + where + `
		),
		session_starts AS (
			SELECT
				identifier,
				service_name,
				timestamp,
				CASE
					WHEN prev_ts IS NULL OR EXTRACT(EPOCH FROM (timestamp - prev_ts)) > 1800 THEN 1
					ELSE 0
				END AS is_new_session
			FROM ranked
		),
		session_groups AS (
			SELECT
				identifier,
				service_name,
				timestamp,
				SUM(is_new_session) OVER (PARTITION BY identifier, service_name ORDER BY timestamp) AS session_id
			FROM session_starts
		)
		SELECT
			identifier,
			service_name,
			TO_CHAR(MIN(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS session_start,
			TO_CHAR(MAX(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS session_end,
			EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) AS duration_seconds,
			COUNT(*) AS event_count
		FROM session_groups
		GROUP BY identifier, service_name, session_id
		ORDER BY MIN(timestamp) DESC
		LIMIT 200
	`

	var sessions []Session
	if err := r.db.Raw(query, args...).Scan(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *repository) GetSessionByID(sessionID string) (*SessionDetail, error) {
	var events []AuditSummary
	err := r.db.Model(&Audit{}).
		Where("session_id = ?", sessionID).
		Select("id, event_type, identifier, user_email, user_name, method, path, status_code, service_name, timestamp, response_time").
		Order("timestamp ASC").
		Find(&events).Error
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, nil
	}

	var meta struct {
		Identifier      string
		ServiceName     string
		SessionStart    string
		SessionEnd      string
		DurationSeconds float64
		EventCount      int64
	}
	r.db.Model(&Audit{}).
		Where("session_id = ?", sessionID).
		Select(`
			identifier,
			service_name,
			TO_CHAR(MIN(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS session_start,
			TO_CHAR(MAX(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS session_end,
			EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) AS duration_seconds,
			COUNT(*) AS event_count
		`).
		Group("identifier, service_name").
		Scan(&meta)

	return &SessionDetail{
		SessionID:       sessionID,
		Identifier:      meta.Identifier,
		ServiceName:     meta.ServiceName,
		SessionStart:    meta.SessionStart,
		SessionEnd:      meta.SessionEnd,
		DurationSeconds: meta.DurationSeconds,
		EventCount:      meta.EventCount,
		Events:          events,
	}, nil
}

func (r *repository) GetStats(projectID string) (*AuditStats, error) {
	stats := &AuditStats{
		ByService:     []ServiceBreakdown{},
		ByStatusClass: map[string]int64{"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0},
		ByMethod:      map[string]int64{},
		Timeline:      []TimelinePoint{},
	}

	base := func() *gorm.DB {
		q := r.db.Model(&Audit{})
		if projectID != "" {
			q = q.Where("project_id = ?", projectID)
		}
		return q
	}

	// Main metrics
	type mainRow struct {
		Total           int64   `gorm:"column:total"`
		Errors4xx       int64   `gorm:"column:errors_4xx"`
		Errors5xx       int64   `gorm:"column:errors_5xx"`
		AvgResponseTime float64 `gorm:"column:avg_response_time"`
		P95ResponseTime float64 `gorm:"column:p95_response_time"`
		ActiveServices  int64   `gorm:"column:active_services"`
		LastEventAt     string  `gorm:"column:last_event_at"`
	}
	var m mainRow
	base().Select(`
		COUNT(*) AS total,
		COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) AS errors_4xx,
		COUNT(CASE WHEN status_code >= 500 THEN 1 END) AS errors_5xx,
		COALESCE(AVG(response_time), 0) AS avg_response_time,
		COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time), 0) AS p95_response_time,
		COUNT(DISTINCT service_name) AS active_services,
		COALESCE(TO_CHAR(MAX(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') AS last_event_at
	`).Scan(&m)

	stats.Total = m.Total
	stats.Errors4xx = m.Errors4xx
	stats.Errors5xx = m.Errors5xx
	stats.AvgResponseTime = m.AvgResponseTime
	stats.P95ResponseTime = m.P95ResponseTime
	stats.ActiveServices = m.ActiveServices
	stats.LastEventAt = m.LastEventAt

	// By service
	type serviceRow struct {
		ServiceName     string
		Requests        int64
		Errors          int64
		AvgResponseTime float64
		LastEvent       string
	}
	var serviceRows []serviceRow
	base().Select(`
		service_name,
		COUNT(*) AS requests,
		COUNT(CASE WHEN status_code >= 400 THEN 1 END) AS errors,
		COALESCE(AVG(response_time), 0) AS avg_response_time,
		COALESCE(TO_CHAR(MAX(timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') AS last_event
	`).Group("service_name").Order("COUNT(*) DESC").Scan(&serviceRows)
	for _, row := range serviceRows {
		stats.ByService = append(stats.ByService, ServiceBreakdown(row))
	}

	// By status class
	type statusRow struct {
		Class string
		Count int64
	}
	var statusRows []statusRow
	base().Select(`
		CASE
			WHEN status_code >= 500 THEN '5xx'
			WHEN status_code >= 400 THEN '4xx'
			WHEN status_code >= 300 THEN '3xx'
			ELSE '2xx'
		END AS class,
		COUNT(*) AS count
	`).Group("class").Scan(&statusRows)
	for _, row := range statusRows {
		stats.ByStatusClass[row.Class] = row.Count
	}

	// By method
	type methodRow struct {
		Method string
		Count  int64
	}
	var methodRows []methodRow
	base().Select("method, COUNT(*) AS count").Group("method").Scan(&methodRows)
	for _, row := range methodRows {
		stats.ByMethod[row.Method] = row.Count
	}

	// Timeline — events per hour last 24h
	type timelineRow struct {
		Hour  string
		Count int64
	}
	var timelineRows []timelineRow
	tq := r.db.Model(&Audit{}).
		Select(`TO_CHAR(DATE_TRUNC('hour', timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS hour, COUNT(*) AS count`).
		Where("timestamp >= NOW() - INTERVAL '24 hours'")
	if projectID != "" {
		tq = tq.Where("project_id = ?", projectID)
	}
	tq.Group("hour").Order("hour ASC").Scan(&timelineRows)
	for _, row := range timelineRows {
		stats.Timeline = append(stats.Timeline, TimelinePoint(row))
	}

	return stats, nil
}

func (r *repository) GetOrphans(filters OrphanFilters) ([]AuditSummary, error) {
	query := r.db.Model(&Audit{}).
		Where("source = ?", "browser").
		Where("request_id != ''").
		Where("NOT EXISTS (SELECT 1 FROM audits a WHERE a.source = 'backend' AND a.request_id = audits.request_id AND a.request_id != '')")

	if filters.ProjectID != "" {
		query = query.Where("project_id = ?", filters.ProjectID)
	}
	if filters.ServiceName != "" {
		query = query.Where("service_name = ?", filters.ServiceName)
	}
	if filters.StartDate != nil {
		query = query.Where("timestamp >= ?", filters.StartDate)
	}
	if filters.EndDate != nil {
		query = query.Where("timestamp <= ?", filters.EndDate)
	}

	var orphans []AuditSummary
	err := query.
		Select("id, event_type, identifier, user_email, user_name, method, path, status_code, service_name, timestamp, response_time").
		Order("timestamp DESC").
		Limit(100).
		Find(&orphans).Error

	return orphans, err
}
