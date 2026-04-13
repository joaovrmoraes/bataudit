package anomaly

import "time"

// RuleType identifies the kind of anomaly to detect.
type RuleType string

const (
	RuleVolumeSpike      RuleType = "volume_spike"        // Events/min spike vs hourly average
	RuleErrorRate        RuleType = "error_rate"           // 4xx+5xx rate exceeds threshold%
	RuleBruteForce       RuleType = "brute_force"          // Same identifier with N failed auth attempts
	RuleSilentService    RuleType = "silent_service"       // No events for longer than threshold minutes
	RuleMassDelete       RuleType = "mass_delete"          // More than N DELETE requests in window
	RuleErrorRateByRoute RuleType = "error_rate_by_route"  // 4xx+5xx rate per (path, method) exceeds threshold%
)

// AnomalyRule is a per-project detection rule stored in the database.
type AnomalyRule struct {
	ID            string    `json:"id"             gorm:"primaryKey"`
	ProjectID     string    `json:"project_id"`
	RuleType      RuleType  `json:"rule_type"`
	// Threshold semantics per rule type:
	//   volume_spike   → z-score multiplier (e.g. 3.0 = mean + 3σ)
	//   error_rate     → percentage (e.g. 20 = 20%)
	//   brute_force    → count of 401/403 from same identifier
	//   silent_service → minutes without events
	//   mass_delete    → count of DELETE requests in window
	Threshold     float64   `json:"threshold"`
	WindowSeconds int       `json:"window_seconds"`
	Active        bool      `json:"active"`
	CreatedAt     time.Time `json:"created_at"`
}

// DefaultRules returns the set of rules automatically created for new projects.
func DefaultRules(projectID string) []AnomalyRule {
	now := time.Now()
	return []AnomalyRule{
		{ProjectID: projectID, RuleType: RuleVolumeSpike,   Threshold: 3.0, WindowSeconds: 60,  Active: true, CreatedAt: now},
		{ProjectID: projectID, RuleType: RuleErrorRate,     Threshold: 20,  WindowSeconds: 300, Active: true, CreatedAt: now},
		{ProjectID: projectID, RuleType: RuleBruteForce,    Threshold: 10,  WindowSeconds: 300, Active: true, CreatedAt: now},
		{ProjectID: projectID, RuleType: RuleSilentService, Threshold: 15,  WindowSeconds: 0,   Active: true, CreatedAt: now},
		{ProjectID: projectID, RuleType: RuleMassDelete,    Threshold: 50,  WindowSeconds: 300, Active: true, CreatedAt: now},
	}
}

// AlertSink is implemented by the caller (worker) to persist detected alerts.
type AlertSink interface {
	CreateAlert(projectID, serviceName, environment string, ruleType RuleType, details map[string]any) error
}
