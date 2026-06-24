package notification

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testSender() *Sender {
	return &Sender{httpClient: &http.Client{Timeout: 3 * time.Second}}
}

func webhookChannel(url, secret string) Channel {
	cfg, _ := json.Marshal(WebhookConfig{URL: url, Secret: secret})
	return Channel{ID: "ch1", Type: ChannelWebhook, Config: cfg}
}

func testPayload() AlertPayload {
	return AlertPayload{EventID: "e1", ProjectID: "p1", ServiceName: "svc", RuleType: "test", Timestamp: time.Now()}
}

func TestSendWebhook_Success(t *testing.T) {
	var gotBody []byte
	var gotSig string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotBody, _ = io.ReadAll(r.Body)
		gotSig = r.Header.Get("X-BatAudit-Signature")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	code, body, err := testSender().sendWebhook(context.Background(), webhookChannel(srv.URL, "s3cr3t"), testPayload())
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if code != 200 {
		t.Errorf("expected 200, got %d", code)
	}
	if body == "" {
		t.Error("expected response body")
	}
	if len(gotBody) == 0 {
		t.Error("endpoint received empty body")
	}
	if gotSig == "" {
		t.Error("expected HMAC signature header when secret is set")
	}
}

func TestSendWebhook_TargetReturns500_KeepsRealCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))
	defer srv.Close()

	code, body, err := testSender().sendWebhook(context.Background(), webhookChannel(srv.URL, ""), testPayload())
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
	if code != 500 {
		t.Errorf("expected real status code 500 to be preserved, got %d", code)
	}
	if body != "boom" {
		t.Errorf("expected real response body preserved, got %q", body)
	}
}

func TestSendWebhook_Returns404_NoRetryKeepsCode(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	code, _, err := testSender().sendWebhook(context.Background(), webhookChannel(srv.URL, ""), testPayload())
	if err == nil || code != 404 {
		t.Fatalf("expected 404 with error, got code=%d err=%v", code, err)
	}
	if calls != 1 {
		t.Errorf("4xx should not be retried, got %d calls", calls)
	}
}

func TestSendWebhook_Unreachable_Code0(t *testing.T) {
	// Reserved-but-closed port to force a connection error quickly.
	code, _, err := testSender().sendWebhook(context.Background(), webhookChannel("http://127.0.0.1:1/hook", ""), testPayload())
	if err == nil {
		t.Fatal("expected connection error")
	}
	if code != 0 {
		t.Errorf("expected code 0 for unreachable endpoint, got %d", code)
	}
}
