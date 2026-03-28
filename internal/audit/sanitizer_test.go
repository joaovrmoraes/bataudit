package audit

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// --- sanitizeString ---

func TestSanitizeString_TrimsSpace(t *testing.T) {
	assert.Equal(t, "hello world", sanitizeString("  hello world  "))
}

func TestSanitizeString_RemovesControlChars(t *testing.T) {
	assert.Equal(t, "helloworld", sanitizeString("hello\x00world"))
	assert.Equal(t, "helloworld", sanitizeString("hello\x1Fworld"))
	assert.Equal(t, "helloworld", sanitizeString("hello\x7Fworld"))
}

func TestSanitizeString_EscapesHTML(t *testing.T) {
	result := sanitizeString("<script>alert('xss')</script>")
	assert.NotContains(t, result, "<script>")
	assert.Contains(t, result, "&lt;script&gt;")
}

func TestSanitizeString_CollapsesSpaces(t *testing.T) {
	assert.Equal(t, "hello world", sanitizeString("hello   world"))
}

func TestSanitizeString_EmptyString(t *testing.T) {
	assert.Equal(t, "", sanitizeString(""))
}

// --- sanitizeEmail ---

func TestSanitizeEmail_ValidEmail(t *testing.T) {
	assert.Equal(t, "user@example.com", sanitizeEmail("user@example.com"))
}

func TestSanitizeEmail_RemovesInvalidChars(t *testing.T) {
	result := sanitizeEmail("user<script>@example.com")
	assert.NotContains(t, result, "<")
	assert.NotContains(t, result, ">")
}

func TestSanitizeEmail_Empty(t *testing.T) {
	assert.Equal(t, "", sanitizeEmail(""))
}

// --- sanitizeIP ---

func TestSanitizeIP_IPv4(t *testing.T) {
	assert.Equal(t, "192.168.1.1", sanitizeIP("192.168.1.1"))
}

func TestSanitizeIP_IPv6(t *testing.T) {
	assert.Equal(t, "::1", sanitizeIP("::1"))
}

func TestSanitizeIP_RemovesInvalidChars(t *testing.T) {
	result := sanitizeIP("192.168.1.1; DROP TABLE")
	assert.NotContains(t, result, " ")
	assert.NotContains(t, result, ";")
}

// --- sanitizeEnvironment ---

func TestSanitizeEnvironment_Prod(t *testing.T) {
	assert.Equal(t, "production", sanitizeEnvironment("prod"))
	assert.Equal(t, "production", sanitizeEnvironment("PRODUCTION"))
	assert.Equal(t, "production", sanitizeEnvironment("production"))
}

func TestSanitizeEnvironment_Staging(t *testing.T) {
	assert.Equal(t, "staging", sanitizeEnvironment("staging"))
	assert.Equal(t, "staging", sanitizeEnvironment("stage"))
	assert.Equal(t, "staging", sanitizeEnvironment("homolog"))
}

func TestSanitizeEnvironment_Dev(t *testing.T) {
	assert.Equal(t, "development", sanitizeEnvironment("dev"))
	assert.Equal(t, "development", sanitizeEnvironment("development"))
}

func TestSanitizeEnvironment_Testing(t *testing.T) {
	assert.Equal(t, "testing", sanitizeEnvironment("test"))
	assert.Equal(t, "testing", sanitizeEnvironment("testing"))
}

func TestSanitizeEnvironment_Local(t *testing.T) {
	assert.Equal(t, "local", sanitizeEnvironment("local"))
}

func TestSanitizeEnvironment_UnknownDefaultsToDev(t *testing.T) {
	assert.Equal(t, "development", sanitizeEnvironment("unknown"))
	assert.Equal(t, "development", sanitizeEnvironment(""))
}

// --- DetectSensitiveData ---

func TestDetectSensitiveData_PasswordField(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"password":"secret123"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_PasswdField(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"passwd":"secret123"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_PwdField(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"pwd":"secret123"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_SecretField(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"secret":"mysecret"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_CreditCard(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"card":"4111111111111111"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_APIKey(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"key_abc123def456ghi789": "value"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_InQueryParams(t *testing.T) {
	audit := &Audit{
		QueryParams: []byte(`{"password":"test"}`),
	}
	assert.True(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_NothingSensitive(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"username":"john","action":"login"}`),
	}
	assert.False(t, DetectSensitiveData(audit))
}

func TestDetectSensitiveData_EmptyBody(t *testing.T) {
	audit := &Audit{}
	assert.False(t, DetectSensitiveData(audit))
}

// --- MaskSensitiveData ---

func TestMaskSensitiveData_MasksPassword(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"password":"mysecret"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.RequestBody), "********")
	assert.NotContains(t, string(audit.RequestBody), "mysecret")
}

func TestMaskSensitiveData_MasksPasswd(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"passwd":"mysecret"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.RequestBody), "********")
	assert.NotContains(t, string(audit.RequestBody), "mysecret")
}

func TestMaskSensitiveData_MasksPwd(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"pwd":"mysecret"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.RequestBody), "********")
	assert.NotContains(t, string(audit.RequestBody), "mysecret")
}

func TestMaskSensitiveData_MasksSecret(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"secret":"topsecret"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.RequestBody), "********")
	assert.NotContains(t, string(audit.RequestBody), "topsecret")
}

func TestMaskSensitiveData_MasksCreditCard(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"card":"4111111111111111"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.RequestBody), "************")
	assert.NotContains(t, string(audit.RequestBody), "41111111")
}

func TestMaskSensitiveData_MasksQueryParams(t *testing.T) {
	audit := &Audit{
		QueryParams: []byte(`{"password":"secret"}`),
	}
	MaskSensitiveData(audit)
	assert.Contains(t, string(audit.QueryParams), "********")
	assert.NotContains(t, string(audit.QueryParams), "secret")
}

func TestMaskSensitiveData_PreservesOtherFields(t *testing.T) {
	audit := &Audit{
		RequestBody: []byte(`{"username":"john","password":"secret"}`),
	}
	MaskSensitiveData(audit)
	body := string(audit.RequestBody)
	assert.Contains(t, body, "john")
	assert.Contains(t, body, "********")
}

func TestMaskSensitiveData_EmptyBody(t *testing.T) {
	audit := &Audit{}
	MaskSensitiveData(audit)
	assert.Nil(t, audit.RequestBody)
}

// --- SanitizeAudit (integration) ---

func TestSanitizeAudit_XSSInPath(t *testing.T) {
	audit := &Audit{
		Path:        "/api/<script>alert(1)</script>",
		Identifier:  "user-1",
		ServiceName: "my-service",
		Environment: "production",
	}
	SanitizeAudit(audit)
	assert.NotContains(t, audit.Path, "<script>")
}

func TestSanitizeAudit_NormalizesEnvironment(t *testing.T) {
	audit := &Audit{
		Environment: "prod",
	}
	SanitizeAudit(audit)
	assert.Equal(t, "production", audit.Environment)
}
