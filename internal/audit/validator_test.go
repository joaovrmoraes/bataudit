package audit

import (
	"testing"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
)

// newValidator returns a configured validator for use in tests.
func newValidator() *validator.Validate {
	v := validator.New()
	RegisterCustomValidations(v)
	return v
}

// validBase returns a minimal valid Audit for use as base in tests.
func validBase() Audit {
	return Audit{
		ID:          "550e8400-e29b-41d4-a716-446655440000",
		Method:      GET,
		Path:        "/api/v1/users",
		StatusCode:  200,
		Identifier:  "user-123",
		ServiceName: "my-service",
		Environment: "production",
		Timestamp:   time.Now(),
	}
}

// --- HTTP Method ---

func TestValidateHTTPMethod_ValidMethods(t *testing.T) {
	v := newValidator()
	for _, m := range []HTTPMethod{GET, POST, PUT, DELETE} {
		a := validBase()
		a.Method = m
		err := v.Struct(&a)
		assert.NoError(t, err, "method %s should be valid", m)
	}
}

func TestValidateHTTPMethod_InvalidMethod(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.Method = "INVALID"
	err := v.Struct(&a)
	assert.Error(t, err)
}

// --- IP ---

func TestValidateIP_ValidIPv4(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.IP = "192.168.0.1"
	assert.NoError(t, v.Struct(&a))
}

func TestValidateIP_ValidIPv6(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.IP = "::1"
	assert.NoError(t, v.Struct(&a))
}

func TestValidateIP_EmptyIsValid(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.IP = ""
	assert.NoError(t, v.Struct(&a))
}

func TestValidateIP_InvalidIP(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.IP = "999.999.999.999"
	assert.Error(t, v.Struct(&a))
}

// --- Environment ---

func TestValidateEnvironment_ValidValues(t *testing.T) {
	v := newValidator()
	for _, env := range []string{"production", "staging", "development", "testing", "local"} {
		a := validBase()
		a.Environment = env
		assert.NoError(t, v.Struct(&a), "env %s should be valid", env)
	}
}

func TestValidateEnvironment_InvalidValue(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.Environment = "unknown"
	assert.Error(t, v.Struct(&a))
}

func TestValidateEnvironment_Empty(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.Environment = ""
	assert.Error(t, v.Struct(&a))
}

// --- Email ---

func TestValidateEmail_ValidEmail(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.UserEmail = "user@example.com"
	assert.NoError(t, v.Struct(&a))
}

func TestValidateEmail_EmptyIsValid(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.UserEmail = ""
	assert.NoError(t, v.Struct(&a))
}

func TestValidateEmail_InvalidEmail(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.UserEmail = "not-an-email"
	assert.Error(t, v.Struct(&a))
}

// --- UUID ---

func TestValidateUUID_ValidUUID(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ID = "550e8400-e29b-41d4-a716-446655440000"
	assert.NoError(t, v.Struct(&a))
}

func TestValidateUUID_EmptyIsValid(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ID = ""
	assert.NoError(t, v.Struct(&a))
}

func TestValidateUUID_InvalidUUID(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ID = "not-a-uuid"
	assert.Error(t, v.Struct(&a))
}

// --- ServiceName ---

func TestValidateServiceName_ValidNames(t *testing.T) {
	v := newValidator()
	for _, name := range []string{"my-service", "service_1", "api.v2", "MyService123"} {
		a := validBase()
		a.ServiceName = name
		assert.NoError(t, v.Struct(&a), "service name %q should be valid", name)
	}
}

func TestValidateServiceName_Empty(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ServiceName = ""
	assert.Error(t, v.Struct(&a))
}

func TestValidateServiceName_StartsWithHyphen(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ServiceName = "-invalid"
	assert.Error(t, v.Struct(&a))
}

func TestValidateServiceName_SpecialChars(t *testing.T) {
	v := newValidator()
	a := validBase()
	a.ServiceName = "service name with spaces"
	assert.Error(t, v.Struct(&a))
}

// --- FormatValidationError ---

func TestFormatValidationError_KnownTags(t *testing.T) {
	v := newValidator()

	type requiredStruct struct {
		Field string `validate:"required"`
	}
	err := v.Struct(requiredStruct{})
	if errs, ok := err.(validator.ValidationErrors); ok {
		msg := FormatValidationError(errs[0])
		assert.Equal(t, "This field is required", msg)
	}
}

func TestFormatValidationError_UnknownTagReturnsGeneric(t *testing.T) {
	v := newValidator()
	v.RegisterValidation("custom_tag", func(fl validator.FieldLevel) bool { return false })

	type customStruct struct {
		Field string `validate:"custom_tag"`
	}
	err := v.Struct(customStruct{Field: "value"})
	if errs, ok := err.(validator.ValidationErrors); ok {
		msg := FormatValidationError(errs[0])
		assert.Contains(t, msg, "Validation error")
	}
}
