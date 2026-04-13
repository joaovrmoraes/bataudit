package healthcheck

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// EventSink is implemented by the caller (worker) to persist healthcheck events
// and send notifications on status transitions.
type EventSink interface {
	CreateHealthEvent(projectID, monitorName, monitorURL string, eventType string, details map[string]any) error
}

// Poller runs periodic HTTP checks for all enabled monitors.
type Poller struct {
	repo   Repository
	sink   EventSink
	client *http.Client

	mu       sync.Mutex
	cancels  map[string]context.CancelFunc
}

func NewPoller(repo Repository, sink EventSink) *Poller {
	return &Poller{
		repo:    repo,
		sink:    sink,
		client:  &http.Client{},
		cancels: make(map[string]context.CancelFunc),
	}
}

// Start loads all enabled monitors and begins polling. Reloads every 60 seconds
// to pick up newly created/deleted monitors.
func (p *Poller) Start(ctx context.Context) {
	go func() {
		p.reload(ctx)
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				p.reload(ctx)
			}
		}
	}()
}

// reload loads the current set of enabled monitors and reconciles running goroutines.
func (p *Poller) reload(ctx context.Context) {
	monitors, err := p.repo.ListAllEnabled()
	if err != nil {
		slog.Error("healthcheck: failed to load monitors", "error", err)
		return
	}

	active := make(map[string]bool, len(monitors))
	for _, m := range monitors {
		active[m.ID] = true
	}

	p.mu.Lock()
	// Stop goroutines for removed/disabled monitors.
	for id, cancel := range p.cancels {
		if !active[id] {
			cancel()
			delete(p.cancels, id)
		}
	}
	// Start goroutines for new monitors.
	for _, m := range monitors {
		if _, running := p.cancels[m.ID]; !running {
			mCtx, cancel := context.WithCancel(ctx)
			p.cancels[m.ID] = cancel
			go p.pollMonitor(mCtx, m)
		}
	}
	p.mu.Unlock()
}

// pollMonitor runs the check loop for a single monitor.
func (p *Poller) pollMonitor(ctx context.Context, m Monitor) {
	interval := time.Duration(m.IntervalSeconds) * time.Second
	if interval < 10*time.Second {
		interval = 10 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run an immediate check on start.
	p.check(ctx, m.ID)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.check(ctx, m.ID)
		}
	}
}

// check performs a single HTTP check and updates the database.
func (p *Poller) check(ctx context.Context, monitorID string) {
	m, err := p.repo.GetByID(monitorID)
	if err != nil {
		return
	}
	if !m.Enabled {
		return
	}

	timeout := time.Duration(m.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, m.URL, nil)
	if err != nil {
		p.recordResult(m, StatusDown, nil, nil, err.Error())
		return
	}
	req.Header.Set("User-Agent", "BatAudit-Healthcheck/1.0")

	resp, err := p.client.Do(req)
	elapsed := time.Since(start).Milliseconds()

	var status MonitorStatus
	var statusCode *int
	var responseMs = &elapsed
	var errMsg string

	if err != nil {
		status = StatusDown
		errMsg = err.Error()
	} else {
		resp.Body.Close()
		code := resp.StatusCode
		statusCode = &code
		if code == m.ExpectedStatus {
			status = StatusUp
		} else {
			status = StatusDown
			errMsg = fmt.Sprintf("expected %d, got %d", m.ExpectedStatus, code)
		}
	}

	p.recordResult(m, status, statusCode, responseMs, errMsg)
}

func (p *Poller) recordResult(m *Monitor, status MonitorStatus, statusCode *int, responseMs *int64, errMsg string) {
	now := time.Now()
	prev := m.LastStatus

	result := &Result{
		MonitorID:  m.ID,
		Status:     status,
		StatusCode: statusCode,
		ResponseMs: responseMs,
		Error:      errMsg,
		CheckedAt:  now,
	}

	if err := p.repo.SaveResult(result); err != nil {
		slog.Error("healthcheck: failed to save result", "monitor_id", m.ID, "error", err)
	}

	if err := p.repo.UpdateStatus(m.ID, status, now); err != nil {
		slog.Error("healthcheck: failed to update status", "monitor_id", m.ID, "error", err)
	}

	// Keep only last 200 results.
	if err := p.repo.PruneResults(m.ID, 200); err != nil {
		slog.Warn("healthcheck: failed to prune results", "monitor_id", m.ID, "error", err)
	}

	// Fire events only on state transitions.
	if prev == status || prev == StatusUnknown {
		return
	}

	details := map[string]any{
		"url":             m.URL,
		"expected_status": m.ExpectedStatus,
		"response_ms":     responseMs,
		"error":           errMsg,
	}
	if statusCode != nil {
		details["status_code"] = *statusCode
	}

	var eventType string
	if status == StatusDown {
		eventType = "system.healthcheck.down"
	} else {
		eventType = "system.healthcheck.up"
		if prev == StatusDown && m.LastCheckedAt != nil {
			details["downtime_seconds"] = int64(now.Sub(*m.LastCheckedAt).Seconds())
		}
	}

	if err := p.sink.CreateHealthEvent(m.ProjectID, m.Name, m.URL, eventType, details); err != nil {
		slog.Error("healthcheck: failed to create event", "monitor_id", m.ID, "error", err)
	}
}

// RunCheck performs a single immediate check for the given monitor ID and returns the result.
// Used by the "test now" endpoint.
func (p *Poller) RunCheck(monitorID string) (*Result, error) {
	m, err := p.repo.GetByID(monitorID)
	if err != nil {
		return nil, err
	}

	timeout := time.Duration(m.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.URL, nil)
	if err != nil {
		return &Result{Status: StatusDown, Error: err.Error(), CheckedAt: time.Now()}, nil
	}
	req.Header.Set("User-Agent", "BatAudit-Healthcheck/1.0")

	resp, err := p.client.Do(req)
	elapsed := time.Since(start).Milliseconds()

	result := &Result{
		MonitorID:  m.ID,
		ResponseMs: &elapsed,
		CheckedAt:  time.Now(),
	}

	if err != nil {
		result.Status = StatusDown
		result.Error = err.Error()
	} else {
		resp.Body.Close()
		code := resp.StatusCode
		result.StatusCode = &code
		if code == m.ExpectedStatus {
			result.Status = StatusUp
		} else {
			result.Status = StatusDown
			result.Error = fmt.Sprintf("expected %d, got %d", m.ExpectedStatus, code)
		}
	}

	return result, nil
}
