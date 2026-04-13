package healthcheck

import "time"

type MonitorStatus string

const (
	StatusUp      MonitorStatus = "up"
	StatusDown    MonitorStatus = "down"
	StatusUnknown MonitorStatus = "unknown"
)

type Monitor struct {
	ID              string        `json:"id"               gorm:"primaryKey"`
	ProjectID       string        `json:"project_id"`
	Name            string        `json:"name"`
	URL             string        `json:"url"`
	IntervalSeconds int           `json:"interval_seconds"`
	TimeoutSeconds  int           `json:"timeout_seconds"`
	ExpectedStatus  int           `json:"expected_status"`
	Enabled         bool          `json:"enabled"`
	LastStatus      MonitorStatus `json:"last_status"`
	LastCheckedAt   *time.Time    `json:"last_checked_at"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

func (Monitor) TableName() string { return "healthcheck_monitors" }

type Result struct {
	ID         string        `json:"id"          gorm:"primaryKey"`
	MonitorID  string        `json:"monitor_id"`
	Status     MonitorStatus `json:"status"`
	StatusCode *int          `json:"status_code"`
	ResponseMs *int64        `json:"response_ms"`
	Error      string        `json:"error"`
	CheckedAt  time.Time     `json:"checked_at"`
}

func (Result) TableName() string { return "healthcheck_results" }
