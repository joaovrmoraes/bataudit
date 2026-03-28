//go:build ignore

// Seed populates the database with realistic audit data for development/demo.
// Usage: go run scripts/seed.go
// Optional env vars: same as the main services (DB_HOST, DB_USER, etc.)

package main

import (
	"fmt"
	"log/slog"
	"math/rand"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joaovrmoraes/bataudit/internal/audit"
	"github.com/joaovrmoraes/bataudit/internal/db"
	"gorm.io/gorm"
)

func main() {
	conn, err := db.Init()
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}

	sqlDB, err := conn.DB()
	if err != nil {
		slog.Error("Failed to get underlying DB", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	total := seed(conn)
	slog.Info("Seed complete", "total_events", total)
}

// ---- configuration ----

var services = []struct {
	name  string
	paths []string
}{
	{
		name: "api-gateway",
		paths: []string{
			"/v1/users", "/v1/users/{id}", "/v1/auth/login", "/v1/auth/logout",
			"/v1/products", "/v1/products/{id}", "/v1/orders", "/v1/health",
		},
	},
	{
		name: "payments-service",
		paths: []string{
			"/v1/payments", "/v1/payments/{id}", "/v1/refunds", "/v1/webhooks/stripe",
			"/v1/invoices", "/v1/subscriptions",
		},
	},
	{
		name: "notification-service",
		paths: []string{
			"/v1/notifications/send", "/v1/notifications/{id}", "/v1/templates",
			"/v1/email/send", "/v1/sms/send",
		},
	},
	{
		name: "inventory-service",
		paths: []string{
			"/v1/items", "/v1/items/{id}", "/v1/stock", "/v1/warehouses",
			"/v1/suppliers", "/v1/purchase-orders",
		},
	},
}

var users = []struct {
	id    string
	email string
	name  string
	roles []string
}{
	{"usr_001", "alice@acme.com", "Alice Silva", []string{"admin"}},
	{"usr_002", "bob@acme.com", "Bob Santos", []string{"editor"}},
	{"usr_003", "carol@acme.com", "Carol Lima", []string{"viewer"}},
	{"usr_004", "dave@partner.io", "Dave Costa", []string{"api-client"}},
	{"usr_005", "eve@partner.io", "Eve Oliveira", []string{"api-client"}},
	{"cli_001", "service-account@internal", "Internal Service", []string{"service"}},
}

var methods = []string{"GET", "POST", "PUT", "PATCH", "DELETE"}
var methodWeights = []int{50, 25, 10, 8, 7} // % weight per method

// status code distribution: mostly 2xx, some 4xx, few 5xx
var statusCodes = []struct {
	code   int
	weight int
}{
	{200, 55}, {201, 15}, {204, 5},
	{400, 8}, {401, 4}, {403, 3}, {404, 6}, {422, 2},
	{500, 1}, {502, 1},
}

var ips = []string{
	"203.0.113.10", "198.51.100.42", "192.0.2.100",
	"10.0.0.5", "172.16.0.25", "::1",
}

// ---- seed ----

func seed(conn *gorm.DB) int {
	repo := audit.NewRepository(conn)

	// Distribute events across the last 30 days with realistic density:
	// - Higher volume during business hours (9-18h)
	// - Error spikes at specific windows
	// - Production has 70% of traffic, staging 20%, dev 10%

	now := time.Now()
	total := 0

	// ~3000 events spread over 30 days
	days := 30
	eventsPerDay := []int{}
	for i := 0; i < days; i++ {
		// Weekend has ~40% less traffic
		day := now.AddDate(0, 0, -i)
		if day.Weekday() == time.Saturday || day.Weekday() == time.Sunday {
			eventsPerDay = append(eventsPerDay, randBetween(40, 80))
		} else {
			eventsPerDay = append(eventsPerDay, randBetween(80, 150))
		}
	}

	for dayIdx, count := range eventsPerDay {
		dayStart := now.AddDate(0, 0, -dayIdx).Truncate(24 * time.Hour)

		// Inject an error spike on day 7 and day 20
		isSpike := dayIdx == 7 || dayIdx == 20

		for i := 0; i < count; i++ {
			event := generateEvent(dayStart, isSpike)
			if err := repo.Create(&event); err != nil {
				slog.Warn("Failed to insert event", "error", err)
				continue
			}
			total++
		}
	}

	// Add a dense burst for a specific user in the last 2 hours (to show a clear session)
	burstStart := now.Add(-2 * time.Hour)
	for i := 0; i < 40; i++ {
		e := generateEvent(burstStart, false)
		e.Identifier = "usr_001"
		e.UserEmail = "alice@acme.com"
		e.UserName = "Alice Silva"
		e.ServiceName = "api-gateway"
		e.Environment = "production"
		e.Timestamp = burstStart.Add(time.Duration(i) * 3 * time.Minute)
		if err := repo.Create(&e); err == nil {
			total++
		}
	}

	return total
}

// ---- helpers ----

func generateEvent(dayStart time.Time, isSpike bool) audit.Audit {
	svc := services[rand.Intn(len(services))]
	user := users[rand.Intn(len(users))]
	env := weightedEnv()

	method := weightedMethod()
	statusCode := weightedStatus(isSpike)
	responseTime := generateResponseTime(statusCode)

	// Timestamp: weighted towards business hours
	hour := weightedHour()
	minute := rand.Intn(60)
	second := rand.Intn(60)
	ts := dayStart.Add(time.Duration(hour)*time.Hour + time.Duration(minute)*time.Minute + time.Duration(second)*time.Second)

	path := svc.paths[rand.Intn(len(svc.paths))]

	var errorMsg string
	if statusCode >= 500 {
		errorMsg = randomChoice([]string{
			"internal server error", "database connection timeout",
			"upstream service unavailable", "unexpected nil pointer",
		})
	}

	rolesJSON := fmt.Sprintf(`["%s"]`, user.roles[0])

	return audit.Audit{
		ID:           uuid.New().String(),
		Method:       audit.HTTPMethod(method),
		Path:         path,
		StatusCode:   statusCode,
		ResponseTime: int64(responseTime),
		Identifier:   user.id,
		UserEmail:    user.email,
		UserName:     user.name,
		UserRoles:    []byte(rolesJSON),
		IP:           randomChoice(ips),
		UserAgent:    randomChoice(userAgents),
		RequestID:    fmt.Sprintf("bat-%s", uuid.New().String()[:8]),
		ServiceName:  svc.name,
		Environment:  env,
		Timestamp:    ts,
		ErrorMessage: errorMsg,
	}
}

func weightedMethod() string {
	n := rand.Intn(100)
	sum := 0
	for i, w := range methodWeights {
		sum += w
		if n < sum {
			return methods[i]
		}
	}
	return "GET"
}

func weightedStatus(spike bool) int {
	weights := statusCodes
	if spike {
		// During error spike: 30% chance of 5xx
		if rand.Intn(100) < 30 {
			return randomChoice([]int{500, 502, 503})
		}
	}
	n := rand.Intn(100)
	sum := 0
	for _, s := range weights {
		sum += s.weight
		if n < sum {
			return s.code
		}
	}
	return 200
}

func weightedEnv() string {
	n := rand.Intn(100)
	if n < 70 {
		return "production"
	}
	if n < 90 {
		return "staging"
	}
	return "development"
}

func weightedHour() int {
	// 9-18h gets 70% of traffic
	if rand.Intn(100) < 70 {
		return 9 + rand.Intn(10)
	}
	return rand.Intn(24)
}

func generateResponseTime(status int) int {
	if status >= 500 {
		return randBetween(1000, 10000) // slow on errors
	}
	if status >= 400 {
		return randBetween(50, 500)
	}
	// Normal: mostly fast, occasionally slow
	if rand.Intn(100) < 5 {
		return randBetween(500, 3000) // slow outlier
	}
	return randBetween(5, 250)
}

func randBetween(min, max int) int {
	return min + rand.Intn(max-min+1)
}

func randomChoice[T any](slice []T) T {
	return slice[rand.Intn(len(slice))]
}

var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
	"okhttp/4.9.3",
	"axios/1.4.0",
	"python-requests/2.28.0",
	"Go-http-client/1.1",
	"PostmanRuntime/7.32.3",
}
