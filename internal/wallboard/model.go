package wallboard

import "time"

type Token struct {
	ID          string     `gorm:"primaryKey"`
	Name        string     `gorm:"column:name"`
	ProjectID   string     `gorm:"column:project_id"` // empty = all projects
	Code        string     `gorm:"column:code;uniqueIndex"`
	RefreshHash string     `gorm:"column:refresh_hash"`
	ExpiresAt   time.Time  `gorm:"column:expires_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	LastUsedAt  *time.Time `gorm:"column:last_used_at"`
}

func (Token) TableName() string { return "wallboard_tokens" }

// Summary is the main stats payload for the TV dashboard.
type Summary struct {
	EventsToday    int64   `json:"events_today"    gorm:"column:events_today"`
	Errors4xx      int64   `json:"errors_4xx"      gorm:"column:errors_4xx"`
	Errors5xx      int64   `json:"errors_5xx"      gorm:"column:errors_5xx"`
	AvgResponseMs  float64 `json:"avg_response_ms" gorm:"column:avg_response_ms"`
	ActiveServices int64   `json:"active_services" gorm:"column:active_services"`
}

type FeedEvent struct {
	Method      string `json:"method"       gorm:"column:method"`
	Path        string `json:"path"         gorm:"column:path"`
	StatusCode  int    `json:"status_code"  gorm:"column:status_code"`
	ResponseMs  int64  `json:"response_ms"  gorm:"column:response_ms"`
	ServiceName string `json:"service_name" gorm:"column:service_name"`
	Timestamp   string `json:"timestamp"    gorm:"column:timestamp"`
}

type VolumePoint struct {
	Bucket string `json:"bucket"` // 5-min bucket ISO string
	Count  int64  `json:"count"`
}

type HealthEntry struct {
	Name        string `json:"name"         gorm:"column:name"`
	URL         string `json:"url"          gorm:"column:url"`
	LastStatus  string `json:"last_status"  gorm:"column:last_status"`
	ResponseMs  int64  `json:"response_ms"  gorm:"column:response_ms"`
	LastChecked string `json:"last_checked" gorm:"column:last_checked"`
}

type Project struct {
	ID   string `json:"id"   gorm:"column:id"`
	Name string `json:"name" gorm:"column:name"`
}

type AlertEntry struct {
	RuleType    string `json:"rule_type"    gorm:"column:rule_type"`
	ServiceName string `json:"service_name" gorm:"column:service_name"`
	Environment string `json:"environment"  gorm:"column:environment"`
	Timestamp   string `json:"timestamp"    gorm:"column:timestamp"`
}

type ErrorRoute struct {
	Path       string  `json:"path"        gorm:"column:path"`
	Method     string  `json:"method"      gorm:"column:method"`
	ErrorCount int64   `json:"error_count" gorm:"column:error_count"`
	ErrorRate  float64 `json:"error_rate"  gorm:"column:error_rate"`
}
