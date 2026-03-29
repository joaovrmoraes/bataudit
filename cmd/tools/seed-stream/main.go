// seed-stream continuously POSTs audit events to the Writer HTTP API,
// alternating between normal traffic and anomalous bursts so the worker
// detects anomalies and generates live system.alert events.
//
// Usage:
//
//	go run ./cmd/tools/seed-stream --project bat_<key> [--rate 2] [--duration 0] [--writer http://localhost:8081]
//
// Flags:
//
//	--project   API key (X-API-Key header). Required.
//	--rate      Normal events per second (default 2).
//	--duration  Total seconds to run; 0 = run forever (default 0).
//	--writer    Writer base URL (default http://localhost:8081).
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"time"
)

// auditPayload mirrors the fields accepted by POST /v1/audit.
type auditPayload struct {
	EventType    string `json:"event_type"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	StatusCode   int    `json:"status_code"`
	ResponseTime int64  `json:"response_time"`
	Identifier   string `json:"identifier"`
	UserEmail    string `json:"user_email,omitempty"`
	UserName     string `json:"user_name,omitempty"`
	ServiceName  string `json:"service_name"`
	Environment  string `json:"environment"`
	Timestamp    string `json:"timestamp"`
	IP           string `json:"ip,omitempty"`
	RequestID    string `json:"request_id,omitempty"`
}

var services = []struct {
	name  string
	paths []string
}{
	{"api-gateway", []string{"/v1/users", "/v1/auth/login", "/v1/products", "/v1/orders", "/v1/health"}},
	{"payments-service", []string{"/v1/payments", "/v1/refunds", "/v1/invoices"}},
	{"notification-service", []string{"/v1/notifications/send", "/v1/templates"}},
	{"inventory-service", []string{"/v1/items", "/v1/stock", "/v1/warehouses"}},
}

var demoUsers = []struct {
	id    string
	email string
	name  string
}{
	{"usr_001", "alice@acme.com", "Alice Silva"},
	{"usr_002", "bob@acme.com", "Bob Santos"},
	{"usr_003", "carol@acme.com", "Carol Lima"},
	{"usr_004", "dave@partner.io", "Dave Costa"},
	{"svc_001", "service-account@internal", "Internal Service"},
}

var normalStatus = []struct{ code, weight int }{
	{200, 55}, {201, 15}, {204, 5},
	{400, 8}, {401, 4}, {403, 2}, {404, 8}, {500, 2}, {502, 1},
}

func main() {
	apiKey := flag.String("project", "", "API key (X-API-Key). Required.")
	rate := flag.Float64("rate", 2, "Normal events per second.")
	duration := flag.Int("duration", 0, "Total seconds to run (0 = forever).")
	writerURL := flag.String("writer", "http://localhost:8081", "Writer base URL.")
	flag.Parse()

	if *apiKey == "" {
		slog.Error("--project is required")
		flag.Usage()
		os.Exit(1)
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	endpoint := *writerURL + "/v1/audit"
	client := &http.Client{Timeout: 5 * time.Second}

	var deadline time.Time
	if *duration > 0 {
		deadline = time.Now().Add(time.Duration(*duration) * time.Second)
	}

	sent := 0
	errors := 0
	burstCycle := 0
	// Burst every 30 seconds: cycle through anomaly types.
	burstTypes := []string{"error_rate", "brute_force", "mass_delete", "volume_spike"}
	nextBurst := time.Now().Add(30 * time.Second)
	interval := time.Duration(float64(time.Second) / *rate)

	slog.Info("seed-stream started",
		"writer", endpoint,
		"rate", fmt.Sprintf("%.1f events/s", *rate),
		"duration", func() string {
			if *duration == 0 {
				return "∞"
			}
			return fmt.Sprintf("%ds", *duration)
		}(),
	)

	for {
		if *duration > 0 && time.Now().After(deadline) {
			break
		}

		// Anomaly burst phase every 30 seconds.
		if time.Now().After(nextBurst) {
			btype := burstTypes[burstCycle%len(burstTypes)]
			burstCycle++
			nextBurst = time.Now().Add(30 * time.Second)

			slog.Info(">>> anomaly burst", "type", btype)
			n := sendBurst(client, endpoint, *apiKey, btype)
			sent += n
			slog.Info("<<< burst complete", "type", btype, "sent", n)
		}

		// Normal event.
		p := normalEvent()
		if sendEvent(client, endpoint, *apiKey, p) {
			sent++
		} else {
			errors++
		}

		if sent%50 == 0 && sent > 0 {
			slog.Info("progress", "sent", sent, "errors", errors)
		}

		time.Sleep(interval)
	}

	slog.Info("seed-stream finished", "sent", sent, "errors", errors)
}

// sendBurst sends a burst of events designed to trigger a specific anomaly rule.
func sendBurst(client *http.Client, endpoint, apiKey, btype string) int {
	n := 0
	svc := services[0] // api-gateway

	switch btype {

	case "brute_force":
		// 15 × 401 for same identifier in ~10s → triggers brute_force (threshold 10).
		for i := range 15 {
			p := auditPayload{
				EventType:    "http",
				Method:       "POST",
				Path:         "/v1/auth/login",
				StatusCode:   401,
				ResponseTime: 85,
				Identifier:   "attacker_stream",
				UserEmail:    "attacker@unknown.net",
				ServiceName:  svc.name,
				Environment:  "production",
				Timestamp:    time.Now().Add(-time.Duration(i) * 500 * time.Millisecond).UTC().Format(time.RFC3339),
				IP:           "203.0.113.99",
			}
			if sendEvent(client, endpoint, apiKey, p) {
				n++
			}
			time.Sleep(100 * time.Millisecond)
		}

	case "error_rate":
		// 40 requests, 14 errors (35%) in ~10s → triggers error_rate (threshold 20%).
		for i := range 40 {
			status := 200
			if i < 14 {
				status = randChoice([]int{500, 502, 400, 422})
			}
			user := demoUsers[i%len(demoUsers)]
			p := auditPayload{
				EventType:    "http",
				Method:       "GET",
				Path:         "/v1/payments",
				StatusCode:   status,
				ResponseTime: int64(50 + rand.Intn(200)),
				Identifier:   user.id,
				UserEmail:    user.email,
				ServiceName:  "payments-service",
				Environment:  "production",
				Timestamp:    time.Now().Add(-time.Duration(i) * 250 * time.Millisecond).UTC().Format(time.RFC3339),
			}
			if sendEvent(client, endpoint, apiKey, p) {
				n++
			}
			time.Sleep(50 * time.Millisecond)
		}

	case "mass_delete":
		// 55 DELETE requests in ~10s → triggers mass_delete (threshold 50).
		for i := range 55 {
			p := auditPayload{
				EventType:    "http",
				Method:       "DELETE",
				Path:         fmt.Sprintf("/v1/items/%08x", rand.Uint32()),
				StatusCode:   204,
				ResponseTime: 40,
				Identifier:   "svc_001",
				UserEmail:    "service-account@internal",
				ServiceName:  "inventory-service",
				Environment:  "production",
				Timestamp:    time.Now().Add(-time.Duration(i) * 180 * time.Millisecond).UTC().Format(time.RFC3339),
			}
			if sendEvent(client, endpoint, apiKey, p) {
				n++
			}
			time.Sleep(30 * time.Millisecond)
		}

	case "volume_spike":
		// 80 events in ~5s (normal is ~rate/s) → triggers volume_spike (z-score > 3.0).
		for i := range 80 {
			p := normalEvent()
			p.Timestamp = time.Now().Add(-time.Duration(i) * 60 * time.Millisecond).UTC().Format(time.RFC3339)
			if sendEvent(client, endpoint, apiKey, p) {
				n++
			}
			time.Sleep(20 * time.Millisecond)
		}
	}

	return n
}

func normalEvent() auditPayload {
	svc := services[rand.Intn(len(services))]
	user := demoUsers[rand.Intn(len(demoUsers))]
	methods := []string{"GET", "GET", "GET", "POST", "PUT", "DELETE"}
	method := methods[rand.Intn(len(methods))]
	status := weightedStatus()

	return auditPayload{
		EventType:    "http",
		Method:       method,
		Path:         svc.paths[rand.Intn(len(svc.paths))],
		StatusCode:   status,
		ResponseTime: int64(responseTimeFor(status)),
		Identifier:   user.id,
		UserEmail:    user.email,
		UserName:     user.name,
		ServiceName:  svc.name,
		Environment:  "production",
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		IP:           randChoice([]string{"203.0.113.10", "198.51.100.42", "192.0.2.100"}),
	}
}

func sendEvent(client *http.Client, endpoint, apiKey string, p auditPayload) bool {
	body, err := json.Marshal(p)
	if err != nil {
		return false
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		slog.Warn("send failed", "error", err)
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		slog.Warn("unexpected status", "code", resp.StatusCode)
		return false
	}
	return true
}

func weightedStatus() int {
	n := rand.Intn(100)
	sum := 0
	for _, s := range normalStatus {
		sum += s.weight
		if n < sum {
			return s.code
		}
	}
	return 200
}

func responseTimeFor(status int) int {
	if status >= 500 {
		return 1000 + rand.Intn(5000)
	}
	if status >= 400 {
		return 50 + rand.Intn(450)
	}
	return 5 + rand.Intn(245)
}

func randChoice[T any](s []T) T { return s[rand.Intn(len(s))] }
