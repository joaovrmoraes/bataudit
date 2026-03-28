package tiering

import "time"

type PeriodType string

const (
	PeriodHour PeriodType = "hour"
	PeriodDay  PeriodType = "day"
)

// AuditSummary is a pre-aggregated row stored in audit_summaries.
type AuditSummary struct {
	ID          string     `gorm:"primaryKey"`
	PeriodStart time.Time  `gorm:"column:period_start"`
	PeriodType  PeriodType `gorm:"column:period_type"`
	ProjectID   string     `gorm:"column:project_id"`
	ServiceName string     `gorm:"column:service_name"`
	Status2xx   int64      `gorm:"column:status_2xx"`
	Status3xx   int64      `gorm:"column:status_3xx"`
	Status4xx   int64      `gorm:"column:status_4xx"`
	Status5xx   int64      `gorm:"column:status_5xx"`
	AvgMs       float64    `gorm:"column:avg_ms"`
	P95Ms       float64    `gorm:"column:p95_ms"`
	EventCount  int64      `gorm:"column:event_count"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
}

func (AuditSummary) TableName() string { return "audit_summaries" }

// HistoryPoint is a single item returned by the history API.
type HistoryPoint struct {
	PeriodStart time.Time  `json:"period_start"`
	PeriodType  PeriodType `json:"period_type"`
	EventCount  int64      `json:"event_count"`
	Errors4xx   int64      `json:"errors_4xx"`
	Errors5xx   int64      `json:"errors_5xx"`
	AvgMs       float64    `json:"avg_ms"`
	P95Ms       float64    `json:"p95_ms"`
}

// UsageStat holds a rough size estimate for a project.
type UsageStat struct {
	RawEvents      int64 `json:"raw_events"`
	HourlySummaries int64 `json:"hourly_summaries"`
	DailySummaries  int64 `json:"daily_summaries"`
}
