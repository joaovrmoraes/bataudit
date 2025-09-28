package audit

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/datatypes"
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
	ID           string     `json:"id" validate:"valid_uuid"`                         // Unique ID of the audit record
	Method       HTTPMethod `json:"method" validate:"required,valid_http_method"`     // HTTP method (GET, POST, PUT, DELETE)
	Path         string     `json:"path" validate:"required,max=255"`                 // API path accessed
	StatusCode   int        `json:"status_code" validate:"omitempty,min=100,max=599"` // HTTP status code of the response
	ResponseTime int64      `json:"response_time" validate:"omitempty,min=0"`         // Response time in ms

	// User info
	Identifier string         `json:"identifier" validate:"required,min=1,max=100"`          // ID of the user or API client
	UserEmail  string         `json:"user_email,omitempty" validate:"omitempty,valid_email"` // User email (if available)
	UserName   string         `json:"user_name,omitempty" validate:"omitempty,max=100"`      // User name (if available)
	UserRoles  datatypes.JSON `json:"user_roles,omitempty" gorm:"type:jsonb"`                // User roles/permissions
	UserType   string         `json:"user_type,omitempty" validate:"omitempty,max=50"`       // User type (admin, client, etc)
	TenantID   string         `json:"tenant_id,omitempty" validate:"omitempty,max=100"`      // Organization/tenant ID (for multi-tenant SaaS)

	// Request info
	IP           string         `json:"ip" validate:"omitempty,valid_ip"`                      // Source IP of the request
	UserAgent    string         `json:"user_agent" validate:"omitempty,max=500"`               // User-Agent of the client
	RequestID    string         `json:"request_id" validate:"omitempty,max=100"`               // Request traceability ID
	QueryParams  datatypes.JSON `json:"query_params,omitempty" gorm:"type:jsonb"`              // Query string parameters
	PathParams   datatypes.JSON `json:"path_params,omitempty" gorm:"type:jsonb"`               // Path parameters
	RequestBody  datatypes.JSON `json:"request_body,omitempty" gorm:"type:jsonb"`              // Request body
	ErrorMessage string         `json:"error_message,omitempty" validate:"omitempty,max=1000"` // Error message (if any)

	// System context
	ServiceName string    `json:"service_name" validate:"required,valid_service_name,max=100"` // Name of the service/API
	Environment string    `json:"environment" validate:"required,valid_environment"`           // Environment (prod, staging, dev)
	Timestamp   time.Time `json:"timestamp" validate:"required"`                               // Timestamp of the request
}

type AuditSummary struct {
	ID           string     `json:"id"`
	Identifier   string     `json:"identifier"`
	UserEmail    string     `json:"user_email"`
	UserName     string     `json:"user_name"`
	Method       HTTPMethod `json:"method"`
	Path         string     `json:"path"`
	StatusCode   int        `json:"status_code"`
	ServiceName  string     `json:"service_name"`
	Timestamp    time.Time  `json:"timestamp"`
	ResponseTime int64      `json:"response_time"`
}
