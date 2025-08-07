package audit

import (
	"time"
)

type Audit struct {
	// Audit record metadata
	ID           string `json:"id"`                         // Unique ID of the audit record
	Method       string `json:"method" validate:"required"` // HTTP method (GET, POST, PUT, DELETE)
	Path         string `json:"path" validate:"required"`   // API path accessed
	StatusCode   int    `json:"status_code"`                // HTTP status code of the response
	ResponseTime int64  `json:"response_time"`              // Response time in ms

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
