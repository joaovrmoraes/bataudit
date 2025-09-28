package audit

import (
	"encoding/json"
	"html"
	"regexp"
	"strings"
)

// SanitizeAudit - clean and sanitize audit data to prevent XSS and other injection attacks
func SanitizeAudit(audit *Audit) {
	audit.Path = sanitizeString(audit.Path)
	audit.Identifier = sanitizeString(audit.Identifier)
	audit.UserEmail = sanitizeEmail(audit.UserEmail)
	audit.UserName = sanitizeString(audit.UserName)
	audit.UserType = sanitizeString(audit.UserType)
	audit.TenantID = sanitizeString(audit.TenantID)
	audit.IP = sanitizeIP(audit.IP)
	audit.UserAgent = sanitizeString(audit.UserAgent)
	audit.RequestID = sanitizeString(audit.RequestID)
	audit.ErrorMessage = sanitizeString(audit.ErrorMessage)
	audit.ServiceName = sanitizeString(audit.ServiceName)
	audit.Environment = sanitizeEnvironment(audit.Environment)

	if len(audit.UserRoles) > 0 {
		audit.UserRoles = sanitizeJSON(audit.UserRoles)
	}
	if len(audit.QueryParams) > 0 {
		audit.QueryParams = sanitizeJSON(audit.QueryParams)
	}
	if len(audit.PathParams) > 0 {
		audit.PathParams = sanitizeJSON(audit.PathParams)
	}
	if len(audit.RequestBody) > 0 {
		audit.RequestBody = sanitizeJSON(audit.RequestBody)
	}
}

// sanitizeString - clean and sanitize a simple string
func sanitizeString(input string) string {
	controlChars := regexp.MustCompile(`[\x00-\x1F\x7F]`)
	input = controlChars.ReplaceAllString(input, "")

	input = html.EscapeString(strings.TrimSpace(input))

	multipleSpaces := regexp.MustCompile(`\s+`)
	input = multipleSpaces.ReplaceAllString(input, " ")

	return input
}

// sanitizeEmail - clean and validate an email address
func sanitizeEmail(email string) string {
	email = sanitizeString(email)

	emailPattern := regexp.MustCompile(`[^a-zA-Z0-9.@_+-]`)
	email = emailPattern.ReplaceAllString(email, "")

	return email
}

// sanitizeIP - clean and validate an IP address
func sanitizeIP(ip string) string {
	ip = sanitizeString(ip)

	ipPattern := regexp.MustCompile(`[^0-9.\:]`)
	ip = ipPattern.ReplaceAllString(ip, "")

	return ip
}

// sanitizeEnvironment - normalize environment names
func sanitizeEnvironment(env string) string {
	env = sanitizeString(env)
	env = strings.ToLower(env)

	switch env {
	case "prod", "production":
		return "production"
	case "staging", "stage", "homolog", "homologation":
		return "staging"
	case "dev", "development":
		return "development"
	case "test", "testing":
		return "testing"
	case "local":
		return "local"
	default:
		return "development"
	}
}

// sanitizeJSON - clean and sanitize JSON data
func sanitizeJSON(jsonData []byte) []byte {
	var data interface{}
	if err := json.Unmarshal(jsonData, &data); err != nil {
		return jsonData
	}

	data = sanitizeJSONValues(data)

	sanitizedJSON, err := json.Marshal(data)
	if err != nil {
		return jsonData
	}
	return sanitizedJSON
}

// sanitizeJSONValues - recursively sanitize values in a JSON data structure
func sanitizeJSONValues(data interface{}) interface{} {
	switch v := data.(type) {
	case string:
		return sanitizeString(v)
	case map[string]interface{}:
		for key, val := range v {
			sanitizedKey := sanitizeString(key)
			v[sanitizedKey] = sanitizeJSONValues(val)
			if sanitizedKey != key {
				delete(v, key)
			}
		}
		return v
	case []interface{}:
		for i, val := range v {
			v[i] = sanitizeJSONValues(val)
		}
		return v
	default:
		return v
	}
}

// DetectSensitiveData - detect sensitive data that may need to be masked
func DetectSensitiveData(audit *Audit) bool {
	sensitiveData := false

	creditCardPattern := regexp.MustCompile(`(?i)(?:\d[ -]*?){13,16}`)

	apiKeyPattern := regexp.MustCompile(`(?i)key[-_]?[0-9a-zA-Z]{16,}`)

	passwordPattern := regexp.MustCompile(`(?i)password|senha|secret`)

	if len(audit.RequestBody) > 0 {
		bodyStr := string(audit.RequestBody)
		if creditCardPattern.MatchString(bodyStr) ||
			apiKeyPattern.MatchString(bodyStr) ||
			passwordPattern.MatchString(bodyStr) {
			sensitiveData = true
		}
	}

	if len(audit.QueryParams) > 0 {
		paramsStr := string(audit.QueryParams)
		if creditCardPattern.MatchString(paramsStr) ||
			apiKeyPattern.MatchString(paramsStr) ||
			passwordPattern.MatchString(paramsStr) {
			sensitiveData = true
		}
	}

	return sensitiveData
}

// MaskSensitiveData - mask sensitive data in audit fields
func MaskSensitiveData(audit *Audit) {
	maskJSON := func(data []byte) []byte {
		if len(data) == 0 {
			return data
		}

		dataStr := string(data)

		creditCardPattern := regexp.MustCompile(`(\d[ -]*?){12}(\d[ -]*?){4}`)
		dataStr = creditCardPattern.ReplaceAllStringFunc(dataStr, func(match string) string {
			digits := regexp.MustCompile(`\d`).FindAllString(match, -1)
			if len(digits) >= 16 {
				return "************" + digits[12] + digits[13] + digits[14] + digits[15]
			}
			return "************" + strings.Join(digits[len(digits)-4:], "")
		})

		passwordPattern := regexp.MustCompile(`(?i)"(password|senha|secret)"\s*:\s*"[^"]*"`)
		dataStr = passwordPattern.ReplaceAllString(dataStr, `"$1":"********"`)

		tokenPattern := regexp.MustCompile(`(?i)"(api[-_]?key|token|secret[-_]?key)"\s*:\s*"[^"]*"`)
		dataStr = tokenPattern.ReplaceAllString(dataStr, `"$1":"********"`)

		return []byte(dataStr)
	}

	if len(audit.RequestBody) > 0 {
		audit.RequestBody = maskJSON(audit.RequestBody)
	}

	if len(audit.QueryParams) > 0 {
		audit.QueryParams = maskJSON(audit.QueryParams)
	}
}
