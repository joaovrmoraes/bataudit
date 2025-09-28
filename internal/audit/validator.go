package audit

import (
	"net"
	"net/mail"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

// RegisterCustomValidations - register custom validations for the Audit model
func RegisterCustomValidations(v *validator.Validate) {
	v.RegisterValidation("valid_http_method", validateHTTPMethod)
	v.RegisterValidation("valid_ip", validateIP)
	v.RegisterValidation("valid_environment", validateEnvironment)
	v.RegisterValidation("valid_email", validateEmail)
	v.RegisterValidation("valid_uuid", validateUUID)
	v.RegisterValidation("valid_url", validateURL)
	v.RegisterValidation("valid_service_name", validateServiceName)
}

// validateHTTPMethod - verifies if the HTTP method is valid
func validateHTTPMethod(fl validator.FieldLevel) bool {
	method, ok := fl.Field().Interface().(HTTPMethod)
	if !ok {
		return false
	}
	return method.IsValid()
}

// validateIP - verifies if the IP address is valid
func validateIP(fl validator.FieldLevel) bool {
	ip := fl.Field().String()

	if ip == "" {
		return true
	}

	parsedIP := net.ParseIP(ip)
	return parsedIP != nil
}

// validateEnvironment - verifies if the environment is one of the allowed values
func validateEnvironment(fl validator.FieldLevel) bool {
	env := strings.ToLower(fl.Field().String())

	if env == "" {
		return false
	}

	validEnvs := map[string]bool{
		"production":  true,
		"staging":     true,
		"development": true,
		"testing":     true,
		"local":       true,
	}

	return validEnvs[env]
}

// validateEmail - verifies if the email address is valid
func validateEmail(fl validator.FieldLevel) bool {
	email := fl.Field().String()

	if email == "" {
		return true
	}

	_, err := mail.ParseAddress(email)
	return err == nil
}

// validateUUID - verifies if the UUID is valid
func validateUUID(fl validator.FieldLevel) bool {
	id := fl.Field().String()

	if id == "" {
		return true
	}

	_, err := uuid.Parse(id)
	return err == nil
}

// validateURL - verifies if the URL is valid
func validateURL(fl validator.FieldLevel) bool {
	url := fl.Field().String()

	if url == "" {
		return true
	}

	urlPattern := `^(http|https):\/\/[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/.*)?$`
	match, err := regexp.MatchString(urlPattern, url)
	return err == nil && match
}

// validateServiceName - verifies if the service name is valid
func validateServiceName(fl validator.FieldLevel) bool {
	serviceName := fl.Field().String()

	if serviceName == "" {
		return false
	}

	validServiceNamePattern := `^[a-zA-Z0-9][a-zA-Z0-9\-_.]{0,99}$`
	match, err := regexp.MatchString(validServiceNamePattern, serviceName)
	return err == nil && match
}

// FormatValidationError - formats validation errors in a user-friendly way
func FormatValidationError(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return "This field is required"
	case "email", "valid_email":
		return "Invalid email format"
	case "min":
		return "The value must be greater than or equal to " + err.Param()
	case "max":
		return "The value must be less than or equal to " + err.Param()
	case "uuid", "valid_uuid":
		return "Invalid UUID format"
	case "valid_http_method":
		return "Invalid HTTP method. Allowed: GET, POST, PUT, DELETE"
	case "valid_environment":
		return "Invalid environment. Allowed: production, staging, development, testing, local"
	case "valid_ip":
		return "Invalid IP address"
	case "valid_url":
		return "Invalid URL"
	case "valid_service_name":
		return "Invalid service name. Use only letters, numbers, hyphen, dot, and underscore"
	default:
		return "Validation error: " + err.Tag()
	}
}
