package anomaly

import (
	"sync"
	"testing"
	"time"
)

// --- Helpers ---

func testEvent(projectID, service, env string, statusCode int, method string) Event {
	return Event{
		ProjectID:   projectID,
		ServiceName: service,
		Environment: env,
		Timestamp:   time.Now(),
		StatusCode:  statusCode,
		Method:      method,
		Identifier:  "user-1",
	}
}

// captureSink records alerts without touching the database.
type captureSink struct {
	mu     sync.Mutex
	alerts []capturedAlert
}

type capturedAlert struct {
	ProjectID   string
	ServiceName string
	RuleType    RuleType
	Details     map[string]any
}

func (s *captureSink) CreateAlert(projectID, serviceName, environment string, rt RuleType, details map[string]any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.alerts = append(s.alerts, capturedAlert{
		ProjectID:   projectID,
		ServiceName: serviceName,
		RuleType:    rt,
		Details:     details,
	})
	return nil
}

func (s *captureSink) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.alerts)
}

func (s *captureSink) last() capturedAlert {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.alerts[len(s.alerts)-1]
}

// staticRepo always returns the given rules, ignoring projectID.
type staticRepo struct {
	rules []AnomalyRule
}

func (r *staticRepo) ListByProject(_ string) ([]AnomalyRule, error) { return r.rules, nil }
func (r *staticRepo) Create(_ *AnomalyRule) error                   { return nil }
func (r *staticRepo) Update(_ *AnomalyRule) error                   { return nil }
func (r *staticRepo) Delete(_ string) error                         { return nil }
func (r *staticRepo) CreateDefaultRules(_ string) error             { return nil }

func newDetector(rules []AnomalyRule) (*Detector, *captureSink) {
	sink := &captureSink{}
	repo := &staticRepo{rules: rules}
	d := NewDetector(repo, sink)
	d.cooldownDur = 0 // disable cooldown so tests can fire multiple alerts
	return d, sink
}

// --- meanStddev ---

func TestMeanStddev_empty(t *testing.T) {
	m, s := meanStddev(nil)
	if m != 0 || s != 0 {
		t.Errorf("expected (0,0), got (%v,%v)", m, s)
	}
}

func TestMeanStddev_uniform(t *testing.T) {
	vals := []float64{4, 4, 4, 4}
	m, s := meanStddev(vals)
	if m != 4 {
		t.Errorf("mean: want 4, got %v", m)
	}
	if s != 0 {
		t.Errorf("stddev: want 0, got %v", s)
	}
}

func TestMeanStddev_known(t *testing.T) {
	// [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, stddev=2
	vals := []float64{2, 4, 4, 4, 5, 5, 7, 9}
	m, s := meanStddev(vals)
	if m != 5 {
		t.Errorf("mean: want 5, got %v", m)
	}
	if s != 2 {
		t.Errorf("stddev: want 2, got %v", s)
	}
}

// --- window ---

func TestWindow_add_and_since(t *testing.T) {
	w := &window{}
	now := time.Now()

	w.add(entry{Timestamp: now.Add(-10 * time.Minute), StatusCode: 200})
	w.add(entry{Timestamp: now.Add(-2 * time.Minute), StatusCode: 404})
	w.add(entry{Timestamp: now.Add(-30 * time.Second), StatusCode: 500})

	recent := w.since(now.Add(-5 * time.Minute))
	if len(recent) != 2 {
		t.Errorf("want 2 entries in last 5m, got %d", len(recent))
	}
}

func TestWindow_trimOldEntries(t *testing.T) {
	w := &window{}
	// Add an entry that is older than 1 hour
	w.add(entry{Timestamp: time.Now().Add(-2 * time.Hour), StatusCode: 200})
	// Add a fresh entry to trigger trim
	w.add(entry{Timestamp: time.Now(), StatusCode: 200})

	w.mu.Lock()
	n := len(w.entries)
	w.mu.Unlock()

	if n != 1 {
		t.Errorf("expected old entry to be trimmed, got %d entries", n)
	}
}

// --- Error rate detector ---

func TestCheckErrorRate_belowThreshold(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleErrorRate, Threshold: 50, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 20; i++ {
		w.add(entry{Timestamp: now, StatusCode: 200, Method: "GET"})
	}
	// 2 errors → 2/22 ≈ 9% < 50%
	w.add(entry{Timestamp: now, StatusCode: 500})
	w.add(entry{Timestamp: now, StatusCode: 500})

	ev := testEvent("p1", "svc", "production", 500, "GET")
	d.checkErrorRate(ev, rule, w)

	if sink.count() != 0 {
		t.Errorf("expected no alert below threshold, got %d", sink.count())
	}
}

func TestCheckErrorRate_aboveThreshold(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleErrorRate, Threshold: 20, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 10; i++ {
		w.add(entry{Timestamp: now, StatusCode: 500, Method: "GET"})
	}
	for i := 0; i < 10; i++ {
		w.add(entry{Timestamp: now, StatusCode: 200, Method: "GET"})
	}
	// 10/20 = 50% errors > 20% threshold

	ev := testEvent("p1", "svc", "production", 500, "GET")
	d.checkErrorRate(ev, rule, w)

	if sink.count() != 1 {
		t.Errorf("expected 1 alert, got %d", sink.count())
	}
	a := sink.last()
	if a.RuleType != RuleErrorRate {
		t.Errorf("expected rule type %s, got %s", RuleErrorRate, a.RuleType)
	}
}

func TestCheckErrorRate_minimumSampleSize(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleErrorRate, Threshold: 5, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	// Only 5 entries — below minimum sample of 10
	for i := 0; i < 5; i++ {
		w.add(entry{Timestamp: time.Now(), StatusCode: 500, Method: "GET"})
	}

	ev := testEvent("p1", "svc", "production", 500, "GET")
	d.checkErrorRate(ev, rule, w)

	if sink.count() != 0 {
		t.Errorf("expected no alert with small sample, got %d", sink.count())
	}
}

// --- Brute force detector ---

func TestCheckBruteForce_ignoresNonAuthErrors(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleBruteForce, Threshold: 3, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 10; i++ {
		w.add(entry{Timestamp: now, StatusCode: 500, Identifier: "attacker"})
	}

	ev := testEvent("p1", "svc", "production", 500, "POST")
	ev.Identifier = "attacker"
	d.checkBruteForce(ev, rule, w)

	if sink.count() != 0 {
		t.Errorf("expected no alert for non-401/403 status, got %d", sink.count())
	}
}

func TestCheckBruteForce_fires(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleBruteForce, Threshold: 5, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 6; i++ {
		w.add(entry{Timestamp: now, StatusCode: 401, Identifier: "hacker"})
	}

	ev := testEvent("p1", "svc", "production", 401, "POST")
	ev.Identifier = "hacker"
	d.checkBruteForce(ev, rule, w)

	if sink.count() != 1 {
		t.Errorf("expected 1 brute-force alert, got %d", sink.count())
	}
	a := sink.last()
	if a.RuleType != RuleBruteForce {
		t.Errorf("wrong rule type: %s", a.RuleType)
	}
	if a.Details["identifier"] != "hacker" {
		t.Errorf("wrong identifier in details: %v", a.Details["identifier"])
	}
}

func TestCheckBruteForce_403(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleBruteForce, Threshold: 3, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 4; i++ {
		w.add(entry{Timestamp: now, StatusCode: 403, Identifier: "bot"})
	}

	ev := testEvent("p1", "svc", "production", 403, "GET")
	ev.Identifier = "bot"
	d.checkBruteForce(ev, rule, w)

	if sink.count() != 1 {
		t.Errorf("expected 1 alert for 403 spam, got %d", sink.count())
	}
}

// --- Mass delete detector ---

func TestCheckMassDelete_ignoresNonDelete(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleMassDelete, Threshold: 5, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 10; i++ {
		w.add(entry{Timestamp: now, StatusCode: 200, Method: "POST"})
	}

	ev := testEvent("p1", "svc", "production", 200, "POST")
	d.checkMassDelete(ev, rule, w)

	if sink.count() != 0 {
		t.Errorf("expected no alert for non-DELETE method, got %d", sink.count())
	}
}

func TestCheckMassDelete_fires(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleMassDelete, Threshold: 10, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 15; i++ {
		w.add(entry{Timestamp: now, StatusCode: 204, Method: "DELETE"})
	}

	ev := testEvent("p1", "svc", "production", 204, "DELETE")
	d.checkMassDelete(ev, rule, w)

	if sink.count() != 1 {
		t.Errorf("expected 1 mass-delete alert, got %d", sink.count())
	}
}

// --- Volume spike detector ---

func TestCheckVolumeSpike_noHistory(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleVolumeSpike, Threshold: 3, WindowSeconds: 60, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	// No history — should not fire
	ev := testEvent("p1", "svc", "production", 200, "GET")
	d.checkVolumeSpike(ev, rule, w)

	if sink.count() != 0 {
		t.Errorf("expected no alert with no history, got %d", sink.count())
	}
}

func TestCheckVolumeSpike_fires(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleVolumeSpike, Threshold: 2, WindowSeconds: 60, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})

	w := d.getOrCreate("p1", "svc")
	now := time.Now()

	// Build history: ~1 event/minute for the past 59 minutes
	for i := 1; i < 60; i++ {
		w.add(entry{Timestamp: now.Add(-time.Duration(i) * time.Minute), StatusCode: 200})
	}
	// Spike: 100 events in the current minute
	for i := 0; i < 100; i++ {
		w.add(entry{Timestamp: now.Add(-10 * time.Second), StatusCode: 200})
	}

	ev := testEvent("p1", "svc", "production", 200, "GET")
	d.checkVolumeSpike(ev, rule, w)

	if sink.count() != 1 {
		t.Errorf("expected 1 volume spike alert, got %d", sink.count())
	}
}

// --- Cooldown ---

func TestCooldown_preventsRepeatedAlerts(t *testing.T) {
	rule := AnomalyRule{RuleType: RuleErrorRate, Threshold: 10, WindowSeconds: 300, Active: true}
	d, sink := newDetector([]AnomalyRule{rule})
	d.cooldownDur = 10 * time.Minute // re-enable cooldown for this test

	w := d.getOrCreate("p1", "svc")
	now := time.Now()
	for i := 0; i < 20; i++ {
		w.add(entry{Timestamp: now, StatusCode: 500, Method: "GET"})
	}

	ev := testEvent("p1", "svc", "production", 500, "GET")

	d.checkErrorRate(ev, rule, w)
	d.checkErrorRate(ev, rule, w) // second call should be suppressed by cooldown

	if sink.count() != 1 {
		t.Errorf("expected cooldown to suppress second alert, got %d alerts", sink.count())
	}
}

// --- Default rules ---

func TestDefaultRules_count(t *testing.T) {
	rules := DefaultRules("project-1")
	if len(rules) != 5 {
		t.Errorf("expected 5 default rules, got %d", len(rules))
	}
}

func TestDefaultRules_types(t *testing.T) {
	rules := DefaultRules("project-1")
	types := make(map[RuleType]bool)
	for _, r := range rules {
		types[r.RuleType] = true
	}
	expected := []RuleType{RuleVolumeSpike, RuleErrorRate, RuleBruteForce, RuleSilentService, RuleMassDelete}
	for _, rt := range expected {
		if !types[rt] {
			t.Errorf("missing default rule type: %s", rt)
		}
	}
}

func TestDefaultRules_allActive(t *testing.T) {
	for _, r := range DefaultRules("project-1") {
		if !r.Active {
			t.Errorf("default rule %s should be active", r.RuleType)
		}
	}
}
