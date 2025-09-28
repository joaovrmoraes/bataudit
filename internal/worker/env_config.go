package worker

import (
	"os"
	"strconv"
	"time"
)

// ConfigureFromEnv configures the worker service from environment variables
func ConfigureFromEnv(config *Config) {
	// Basic worker configuration
	if val := os.Getenv("BATAUDIT_INITIAL_WORKER_COUNT"); val != "" {
		if count, err := strconv.Atoi(val); err == nil && count > 0 {
			config.InitialWorkerCount = count
		}
	}

	if val := os.Getenv("BATAUDIT_MIN_WORKER_COUNT"); val != "" {
		if count, err := strconv.Atoi(val); err == nil && count > 0 {
			config.MinWorkerCount = count
		}
	}

	if val := os.Getenv("BATAUDIT_MAX_WORKER_COUNT"); val != "" {
		if count, err := strconv.Atoi(val); err == nil && count > 0 {
			config.MaxWorkerCount = count
		}
	}

	if val := os.Getenv("BATAUDIT_MAX_RETRIES"); val != "" {
		if retries, err := strconv.Atoi(val); err == nil && retries > 0 {
			config.MaxRetries = retries
		}
	}

	if val := os.Getenv("BATAUDIT_POLL_DURATION"); val != "" {
		if duration, err := time.ParseDuration(val); err == nil && duration > 0 {
			config.PollDuration = duration
		}
	}

	// Autoscaling configuration
	if val := os.Getenv("BATAUDIT_ENABLE_AUTOSCALING"); val != "" {
		switch val {
		case "true", "1", "yes", "y", "on":
			config.EnableAutoscaling = true
		case "false", "0", "no", "n", "off":
			config.EnableAutoscaling = false
		}
	}

	if val := os.Getenv("BATAUDIT_SCALE_UP_THRESHOLD"); val != "" {
		if threshold, err := strconv.ParseInt(val, 10, 64); err == nil && threshold > 0 {
			config.ScaleUpThreshold = threshold
		}
	}

	if val := os.Getenv("BATAUDIT_SCALE_DOWN_THRESHOLD"); val != "" {
		if threshold, err := strconv.ParseInt(val, 10, 64); err == nil && threshold > 0 {
			config.ScaleDownThreshold = threshold
		}
	}

	if val := os.Getenv("BATAUDIT_WORKER_SCALE_FACTOR"); val != "" {
		if factor, err := strconv.ParseFloat(val, 64); err == nil && factor > 0 {
			config.WorkerScaleFactor = factor
		}
	}

	if val := os.Getenv("BATAUDIT_COOLDOWN_PERIOD"); val != "" {
		if period, err := time.ParseDuration(val); err == nil && period > 0 {
			config.CooldownPeriod = period
		}
	}

	// Redis configuration
	if val := os.Getenv("BATAUDIT_REDIS_ADDRESS"); val != "" {
		config.RedisAddress = val
	}

	if val := os.Getenv("BATAUDIT_QUEUE_NAME"); val != "" {
		config.QueueName = val
	}
}
