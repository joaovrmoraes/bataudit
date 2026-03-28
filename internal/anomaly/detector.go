package anomaly

import (
	"context"
	"log/slog"
	"math"
	"sync"
	"time"
)

// Event is a minimal representation of an audit event for detection purposes.
type Event struct {
	ProjectID   string
	ServiceName string
	Environment string
	Timestamp   time.Time
	StatusCode  int
	Method      string
	Identifier  string
}

// entry is a single data point in a sliding window.
type entry struct {
	Timestamp  time.Time
	StatusCode int
	Method     string
	Identifier string
}

// window holds the rolling entries for one (project, service) pair.
type window struct {
	mu          sync.Mutex
	entries     []entry
	lastEventAt time.Time
}

func (w *window) add(e entry) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.entries = append(w.entries, e)
	w.lastEventAt = e.Timestamp

	// Trim entries older than 1 hour (max lookback for any rule)
	cutoff := time.Now().Add(-time.Hour)
	i := 0
	for i < len(w.entries) && w.entries[i].Timestamp.Before(cutoff) {
		i++
	}
	if i > 0 {
		w.entries = w.entries[i:]
	}
}

// since returns a copy of entries at or after the given time.
func (w *window) since(t time.Time) []entry {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := make([]entry, 0)
	for _, e := range w.entries {
		if !e.Timestamp.Before(t) {
			out = append(out, e)
		}
	}
	return out
}

func (w *window) getLastEventAt() time.Time {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.lastEventAt
}

// windowKey builds the map key for a (project, service) pair.
func windowKey(projectID, serviceName string) string {
	return projectID + ":" + serviceName
}

// cooldownKey builds the map key for alert cooldown tracking.
func cooldownKey(projectID string, rt RuleType) string {
	return projectID + ":" + string(rt)
}

// Detector processes audit events and fires alerts when rules are triggered.
type Detector struct {
	mu       sync.RWMutex
	windows  map[string]*window
	cooldown map[string]time.Time // last alert time per (project, ruleType)
	repo     Repository
	sink     AlertSink

	cooldownDur time.Duration // minimum interval between same-type alerts per project
}

// NewDetector creates a Detector backed by the given repository and alert sink.
func NewDetector(repo Repository, sink AlertSink) *Detector {
	return &Detector{
		windows:     make(map[string]*window),
		cooldown:    make(map[string]time.Time),
		repo:        repo,
		sink:        sink,
		cooldownDur: 5 * time.Minute,
	}
}

// Start launches the background goroutine that checks for silent-service anomalies.
func (d *Detector) Start(ctx context.Context) {
	go d.silentServiceLoop(ctx)
}

// getOrCreate returns the window for the given (projectID, serviceName), creating it if needed.
func (d *Detector) getOrCreate(projectID, serviceName string) *window {
	key := windowKey(projectID, serviceName)
	d.mu.Lock()
	w, ok := d.windows[key]
	if !ok {
		w = &window{}
		d.windows[key] = w
	}
	d.mu.Unlock()
	return w
}

// ProcessEvent adds the event to the relevant sliding window and evaluates all rules.
func (d *Detector) ProcessEvent(ev Event) {
	w := d.getOrCreate(ev.ProjectID, ev.ServiceName)

	w.add(entry{
		Timestamp:  ev.Timestamp,
		StatusCode: ev.StatusCode,
		Method:     ev.Method,
		Identifier: ev.Identifier,
	})

	rules, err := d.repo.ListByProject(ev.ProjectID)
	if err != nil {
		slog.Error("anomaly: failed to load rules", "project_id", ev.ProjectID, "error", err)
		return
	}

	for _, rule := range rules {
		if !rule.Active {
			continue
		}
		d.evaluate(ev, rule, w)
	}
}

// evaluate runs a single rule against the current window state.
func (d *Detector) evaluate(ev Event, rule AnomalyRule, w *window) {
	switch rule.RuleType {
	case RuleVolumeSpike:
		d.checkVolumeSpike(ev, rule, w)
	case RuleErrorRate:
		d.checkErrorRate(ev, rule, w)
	case RuleBruteForce:
		d.checkBruteForce(ev, rule, w)
	case RuleMassDelete:
		d.checkMassDelete(ev, rule, w)
	// RuleSilentService is handled by the background loop, not per-event.
	}
}

// checkVolumeSpike detects event-per-minute spikes using z-score.
// It compares the current 1-minute bucket against the mean+Nσ of the previous 59 buckets.
func (d *Detector) checkVolumeSpike(ev Event, rule AnomalyRule, w *window) {
	now := time.Now()
	buckets := make([]float64, 60)

	// Fill buckets: bucket[0] = most recent minute, bucket[59] = oldest
	for _, e := range w.since(now.Add(-time.Hour)) {
		age := now.Sub(e.Timestamp)
		idx := int(age.Minutes())
		if idx >= 0 && idx < 60 {
			buckets[idx]++
		}
	}

	current := buckets[0]
	history := buckets[1:] // 59 previous minutes

	mean, stddev := meanStddev(history)
	if mean < 1 { // not enough history
		return
	}

	if current > mean+rule.Threshold*stddev {
		d.fire(ev, rule.RuleType, map[string]any{
			"current_rpm":  current,
			"baseline_rpm": math.Round(mean*100) / 100,
			"stddev":       math.Round(stddev*100) / 100,
			"z_threshold":  rule.Threshold,
		})
	}
}

// checkErrorRate detects when 4xx/5xx rate exceeds threshold% in the window.
func (d *Detector) checkErrorRate(ev Event, rule AnomalyRule, w *window) {
	since := time.Now().Add(-time.Duration(rule.WindowSeconds) * time.Second)
	entries := w.since(since)
	if len(entries) < 10 { // need a minimum sample size
		return
	}

	errors := 0
	for _, e := range entries {
		if e.StatusCode >= 400 {
			errors++
		}
	}

	rate := float64(errors) / float64(len(entries)) * 100
	if rate >= rule.Threshold {
		d.fire(ev, rule.RuleType, map[string]any{
			"error_rate_pct": math.Round(rate*100) / 100,
			"threshold_pct":  rule.Threshold,
			"error_count":    errors,
			"total_count":    len(entries),
		})
	}
}

// checkBruteForce detects repeated 401/403 from the same identifier.
func (d *Detector) checkBruteForce(ev Event, rule AnomalyRule, w *window) {
	if ev.StatusCode != 401 && ev.StatusCode != 403 {
		return
	}

	since := time.Now().Add(-time.Duration(rule.WindowSeconds) * time.Second)
	entries := w.since(since)

	counts := make(map[string]int)
	for _, e := range entries {
		if e.StatusCode == 401 || e.StatusCode == 403 {
			counts[e.Identifier]++
		}
	}

	if count := counts[ev.Identifier]; float64(count) >= rule.Threshold {
		d.fire(ev, rule.RuleType, map[string]any{
			"identifier":   ev.Identifier,
			"fail_count":   count,
			"threshold":    rule.Threshold,
			"window_secs":  rule.WindowSeconds,
		})
	}
}

// checkMassDelete detects a high volume of DELETE requests in the window.
func (d *Detector) checkMassDelete(ev Event, rule AnomalyRule, w *window) {
	if ev.Method != "DELETE" {
		return
	}

	since := time.Now().Add(-time.Duration(rule.WindowSeconds) * time.Second)
	entries := w.since(since)

	deletes := 0
	for _, e := range entries {
		if e.Method == "DELETE" {
			deletes++
		}
	}

	if float64(deletes) >= rule.Threshold {
		d.fire(ev, rule.RuleType, map[string]any{
			"delete_count": deletes,
			"threshold":    rule.Threshold,
			"window_secs":  rule.WindowSeconds,
		})
	}
}

// silentServiceLoop runs on a ticker and fires alerts for projects that have gone quiet.
func (d *Detector) silentServiceLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.checkAllSilentServices()
		}
	}
}

func (d *Detector) checkAllSilentServices() {
	d.mu.RLock()
	keys := make([]string, 0, len(d.windows))
	for k := range d.windows {
		keys = append(keys, k)
	}
	d.mu.RUnlock()

	for _, key := range keys {
		d.mu.RLock()
		w := d.windows[key]
		d.mu.RUnlock()

		last := w.getLastEventAt()
		if last.IsZero() {
			continue
		}

		// Resolve project from key (format: "projectID:serviceName")
		sep := len(key)
		for i, c := range key {
			if c == ':' {
				sep = i
				break
			}
		}
		projectID := key[:sep]
		serviceName := key[sep+1:]

		rules, err := d.repo.ListByProject(projectID)
		if err != nil {
			continue
		}

		for _, rule := range rules {
			if !rule.Active || rule.RuleType != RuleSilentService {
				continue
			}

			silentMinutes := time.Since(last).Minutes()
			if silentMinutes >= rule.Threshold {
				ev := Event{
					ProjectID:   projectID,
					ServiceName: serviceName,
					Environment: "unknown",
				}
				d.fire(ev, RuleSilentService, map[string]any{
					"silent_minutes": math.Round(silentMinutes*100) / 100,
					"threshold_min":  rule.Threshold,
					"last_event_at":  last.UTC().Format(time.RFC3339),
				})
			}
		}
	}
}

// fire emits an alert if the cooldown for this (project, ruleType) has expired.
func (d *Detector) fire(ev Event, rt RuleType, details map[string]any) {
	ck := cooldownKey(ev.ProjectID, rt)

	d.mu.Lock()
	last, ok := d.cooldown[ck]
	if ok && time.Since(last) < d.cooldownDur {
		d.mu.Unlock()
		return
	}
	d.cooldown[ck] = time.Now()
	d.mu.Unlock()

	slog.Warn("Anomaly detected",
		"project_id", ev.ProjectID,
		"service", ev.ServiceName,
		"rule_type", rt,
		"details", details,
	)

	if err := d.sink.CreateAlert(ev.ProjectID, ev.ServiceName, ev.Environment, rt, details); err != nil {
		slog.Error("anomaly: failed to persist alert", "error", err)
	}
}

// meanStddev returns the mean and population standard deviation of a slice.
func meanStddev(vals []float64) (mean, stddev float64) {
	if len(vals) == 0 {
		return 0, 0
	}
	sum := 0.0
	for _, v := range vals {
		sum += v
	}
	mean = sum / float64(len(vals))

	variance := 0.0
	for _, v := range vals {
		d := v - mean
		variance += d * d
	}
	variance /= float64(len(vals))
	stddev = math.Sqrt(variance)
	return
}
