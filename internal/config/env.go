package config

import (
	"os"
	"strconv"
)

// GetEnv - retrieves an environment variable or returns a default value
func GetEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// GetEnvAsInt - retrieves an environment variable as integer or returns a default value
func GetEnvAsInt(key string, defaultValue int) int {
	if valueStr := GetEnv(key, ""); valueStr != "" {
		if value, err := strconv.Atoi(valueStr); err == nil {
			return value
		}
	}
	return defaultValue
}

// GetEnvAsBool - retrieves an environment variable as boolean or returns a default value
func GetEnvAsBool(key string, defaultValue bool) bool {
	if valueStr := GetEnv(key, ""); valueStr != "" {
		switch valueStr {
		case "true", "1", "yes", "y":
			return true
		case "false", "0", "no", "n":
			return false
		}
	}
	return defaultValue
}
