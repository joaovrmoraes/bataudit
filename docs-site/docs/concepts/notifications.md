---
sidebar_position: 3
title: Notifications
---

# Notifications

BatAudit sends alerts via two channels: **Web Push** (browser notifications) and **Webhooks** (HTTP POST to any URL).

Both are configured in **Dashboard → Settings → Notifications**.

---

## Web Push

Browser Push notifications using the VAPID protocol. Works in Chrome, Firefox, Edge, and Safari (macOS/iOS 16.4+).

### Setup

1. Open **Settings → Notifications** in the dashboard
2. Click **Enable notifications**
3. Accept the browser permission prompt
4. Test with **Send test notification**

### VAPID keys

BatAudit generates ephemeral VAPID keys on startup if none are provided. To persist keys across restarts (required for production — browsers reject pushes from keys they don't recognize):

```bash
# Generate persistent keys
go run ./cmd/api/reader/main.go --generate-vapid

# Add to .env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:you@yourdomain.com
```

---

## Webhooks

HTTP POST requests to any URL with an HMAC-SHA256 signature for verification.

### Adding a webhook

1. Open **Settings → Notifications → Webhooks**
2. Enter the target URL (Discord, Slack, custom endpoint, n8n, etc.)
3. Click **Add webhook**

### Payload

```json
{
  "event_type": "system.alert",
  "rule": "error_rate",
  "service_name": "payments-service",
  "environment": "production",
  "timestamp": "2024-01-15T14:32:00Z",
  "details": {
    "error_rate": 32.5,
    "threshold": 20.0,
    "errors": 13,
    "total": 40
  }
}
```

### Signature verification

Every webhook request includes an `X-BatAudit-Signature` header:

```
X-BatAudit-Signature: sha256=<hmac-hex>
```

Verify it in your receiver:

```typescript
import { createHmac } from 'crypto'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return `sha256=${expected}` === signature
}
```

The webhook secret is displayed once when you create the webhook.

### Retry policy

Failed webhooks (non-2xx response or timeout) are retried with exponential backoff:

| Attempt | Delay |
|---|---|
| 1st retry | 30 seconds |
| 2nd retry | 5 minutes |
| 3rd retry | 30 minutes |

After 3 failed retries, the webhook is marked as failed and no further retries are attempted.

---

## Discord / Slack

Use a standard **Incoming Webhook** URL from Discord or Slack as the webhook endpoint. BatAudit's JSON payload is compatible with both.

For Slack, you may want to use an n8n or Make workflow to transform the payload into Slack's block format.
