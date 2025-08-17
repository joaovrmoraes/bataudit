package audit

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type HTTPMethod string

const (
	GET    HTTPMethod = "GET"
	POST   HTTPMethod = "POST"
	PUT    HTTPMethod = "PUT"
	DELETE HTTPMethod = "DELETE"
)

// UnmarshalJSON implements custom unmarshalling for HTTPMethod
func (m *HTTPMethod) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	s = strings.ToUpper(s)
	switch s {
	case string(GET), string(POST), string(PUT), string(DELETE):
		*m = HTTPMethod(s)
		return nil
	default:
		return fmt.Errorf("invalid HTTP method: %s", s)
	}
}

func (m HTTPMethod) IsValid() bool {
	switch m {
	case GET, POST, PUT, DELETE:
		return true
	}
	return false
}

type Audit struct {
	// Audit record metadata
	ID           string     `json:"id"`                       // Unique ID of the audit record
	Method       HTTPMethod `json:"method"`                   // HTTP method (GET, POST, PUT, DELETE)
	Path         string     `json:"path" validate:"required"` // API path accessed
	StatusCode   int        `json:"status_code"`              // HTTP status code of the response
	ResponseTime int64      `json:"response_time"`            // Response time in ms

	// User info
	Identifier string   `json:"identifier"`           // ID of the user or API client
	UserEmail  string   `json:"user_email,omitempty"` // User email (if available)
	UserName   string   `json:"user_name,omitempty"`  // User name (if available)
	UserRoles  []string `json:"user_roles,omitempty"` // User roles/permissions
	UserType   string   `json:"user_type,omitempty"`  // User type (admin, client, etc)
	TenantID   string   `json:"tenant_id,omitempty"`  // Organization/tenant ID (for multi-tenant SaaS)

	// Request info
	IP           string                 `json:"ip"`                      // Source IP of the request
	UserAgent    string                 `json:"user_agent"`              // User-Agent of the client
	RequestID    string                 `json:"request_id"`              // Request traceability ID
	QueryParams  map[string]string      `json:"query_params,omitempty"`  // Query string parameters
	RequestBody  map[string]interface{} `json:"request_body,omitempty"`  // Request body (sensitive data may be omitted)
	ErrorMessage string                 `json:"error_message,omitempty"` // Error message (if any)

	// System context
	ServiceName string    `json:"service_name"` // Name of the service/API
	Environment string    `json:"environment"`  // Environment (prod, staging, dev)
	Timestamp   time.Time `json:"timestamp"`    // Timestamp of the request
}
