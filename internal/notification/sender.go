package notification

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"
)

// Sender loads active channels for a project and dispatches notifications.
type Sender struct {
	repo       Repository
	vapidPub   string
	vapidPriv  string
	vapidSubj  string
	httpClient *http.Client
}

func NewSender(repo Repository, vapidPub, vapidPriv, vapidSubj string) *Sender {
	return &Sender{
		repo:      repo,
		vapidPub:  vapidPub,
		vapidPriv: vapidPriv,
		vapidSubj: vapidSubj,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// NotifyAll dispatches the alert to every active channel of the project.
// Runs each delivery in a goroutine (fire-and-forget per channel).
func (s *Sender) NotifyAll(ctx context.Context, payload AlertPayload) {
	channels, err := s.repo.ListChannels(payload.ProjectID, "")
	if err != nil {
		slog.Error("notification: failed to load channels", "project_id", payload.ProjectID, "error", err)
		return
	}

	for _, ch := range channels {
		ch := ch
		go func() {
			var (
				status   = "success"
				code     int
				respBody string
				sendErr  error
			)

			switch ch.Type {
			case ChannelWebhook:
				code, respBody, sendErr = s.sendWebhook(ctx, ch, payload)
			case ChannelPush:
				sendErr = s.sendPush(ctx, ch, payload)
			}

			if sendErr != nil {
				status = "failed"
				slog.Warn("notification: delivery failed",
					"channel_id", ch.ID, "type", ch.Type, "error", sendErr)
			}

			_ = s.repo.CreateDelivery(&Delivery{
				ID:           uuid.New().String(),
				ChannelID:    ch.ID,
				AlertEventID: payload.EventID,
				Status:       status,
				StatusCode:   code,
				ResponseBody: respBody,
				DeliveredAt:  time.Now(),
			})
		}()
	}
}

// sendWebhook POSTs the alert payload to the configured URL with optional HMAC signature.
func (s *Sender) sendWebhook(ctx context.Context, ch Channel, payload AlertPayload) (int, string, error) {
	var cfg WebhookConfig
	if err := json.Unmarshal(ch.Config, &cfg); err != nil {
		return 0, "", fmt.Errorf("invalid webhook config: %w", err)
	}

	body, _ := json.Marshal(map[string]any{
		"event_type":   "system.alert",
		"project_id":   payload.ProjectID,
		"service_name": payload.ServiceName,
		"rule_type":    payload.RuleType,
		"message":      fmt.Sprintf("Anomaly detected: %s in service %s", payload.RuleType, payload.ServiceName),
		"timestamp":    payload.Timestamp.UTC().Format(time.RFC3339),
		"details":      payload.Details,
	})

	var lastErr error
	for attempt := range 3 {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewReader(body))
		if err != nil {
			return 0, "", err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "BatAudit/1.0")

		if cfg.Secret != "" {
			mac := hmac.New(sha256.New, []byte(cfg.Secret))
			mac.Write(body)
			req.Header.Set("X-BatAudit-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
		}

		resp, err := s.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(resp.Body)
		resp.Body.Close()

		if resp.StatusCode < 400 {
			return resp.StatusCode, buf.String(), nil
		}
		lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return 0, "", lastErr
}

// sendPush sends a Web Push notification using the VAPID protocol.
func (s *Sender) sendPush(ctx context.Context, ch Channel, payload AlertPayload) error {
	if s.vapidPub == "" || s.vapidPriv == "" {
		return fmt.Errorf("VAPID keys not configured")
	}

	var sub webpush.Subscription
	if err := json.Unmarshal(ch.Config, &sub); err != nil {
		return fmt.Errorf("invalid push config: %w", err)
	}

	msg, _ := json.Marshal(map[string]string{
		"title": "BatAudit Alert",
		"body":  fmt.Sprintf("%s detected in %s", payload.RuleType, payload.ServiceName),
		"url":   "/app/anomalies",
	})

	resp, err := webpush.SendNotificationWithContext(ctx, msg, &sub, &webpush.Options{
		VAPIDPublicKey:  s.vapidPub,
		VAPIDPrivateKey: s.vapidPriv,
		Subscriber:      s.vapidSubj,
		TTL:             3600,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("push service returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// GenerateVAPIDKeys generates a new VAPID key pair.
// Call once and persist the returned keys as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.
func GenerateVAPIDKeys() (pub, priv string, err error) {
	return webpush.GenerateVAPIDKeys()
}
