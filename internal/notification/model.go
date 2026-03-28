package notification

import (
	"encoding/json"
	"time"
)

type ChannelType string

const (
	ChannelPush    ChannelType = "push"
	ChannelWebhook ChannelType = "webhook"
)

// Channel is a delivery target for anomaly alerts.
type Channel struct {
	ID        string          `json:"id"         gorm:"primaryKey"`
	ProjectID string          `json:"project_id"`
	Type      ChannelType     `json:"type"`
	Config    json.RawMessage `json:"config"     gorm:"type:jsonb;serializer:json"`
	Active    bool            `json:"active"`
	CreatedAt time.Time       `json:"created_at"`
}

// Delivery records a single notification attempt.
type Delivery struct {
	ID           string    `json:"id"             gorm:"primaryKey"`
	ChannelID    string    `json:"channel_id"`
	AlertEventID string    `json:"alert_event_id"`
	Status       string    `json:"status"` // success | failed
	StatusCode   int       `json:"status_code,omitempty"`
	ResponseBody string    `json:"response_body,omitempty"`
	DeliveredAt  time.Time `json:"delivered_at"`
}

// WebhookConfig is stored in Channel.Config for webhook channels.
type WebhookConfig struct {
	URL    string `json:"url"`
	Secret string `json:"secret,omitempty"` // HMAC-SHA256 signing secret
}

// PushConfig is stored in Channel.Config for push channels.
// It mirrors the Web Push API Subscription object.
type PushConfig struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		Auth   string `json:"auth"`
		P256dh string `json:"p256dh"`
	} `json:"keys"`
}

// AlertPayload is passed to the Sender when a system.alert event fires.
type AlertPayload struct {
	EventID     string
	ProjectID   string
	ServiceName string
	RuleType    string
	Timestamp   time.Time
	Details     map[string]any
}
