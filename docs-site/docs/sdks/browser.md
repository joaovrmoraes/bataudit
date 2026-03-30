---
sidebar_position: 2
title: Browser SDK
---

# Browser SDK

The `@bataudit/browser` SDK intercepts all `fetch` and `XMLHttpRequest` calls in the browser and sends corresponding audit events to BatAudit.

Its primary use case is detecting **orphan events** — requests the browser initiated but never received a backend response for (network errors, timeouts, CORS failures, connection resets).

---

## Installation

```bash
npm install @bataudit/browser
# or
pnpm add @bataudit/browser
```

---

## Setup

Initialize once at the top of your application entry point:

```typescript
import { BatAuditBrowser } from '@bataudit/browser'

BatAuditBrowser.init({
  apiKey: 'bat_your_api_key',
  serviceName: 'my-frontend',
  writerUrl: 'https://your-bataudit-writer.com',
  environment: 'production',
})
```

From this point, all `fetch` and XHR calls are intercepted automatically.

---

## How it works

For each outgoing request, the Browser SDK:

1. Generates a `X-Request-ID` header and attaches it to the request
2. After the response arrives, sends an audit event with `source: "browser"` and `status_code` from the response
3. If the request **fails** (network error, timeout, CORS), sends an event with `status_code: 0` and an `error_message`

The backend Node.js SDK also reads the `X-Request-ID` header and sends a matching event with `source: "backend"`. BatAudit correlates these by `request_id` — a browser event with no matching backend event is an **orphan**.

---

## Orphan events

An orphan event means a user's request never reached your backend (or your backend never responded). Common causes:

- Network connectivity issues
- CORS misconfiguration
- Server crash mid-request
- Request timeout

BatAudit shows an **orphan events banner** in the dashboard when orphan events exist in the last 24 hours, and exposes them via `GET /v1/audit/orphans`.

---

## Configuration

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | string | ✅ | — | API key from dashboard |
| `serviceName` | string | ✅ | — | Name of this frontend app |
| `writerUrl` | string | ✅ | — | BatAudit Writer URL (must be CORS-accessible) |
| `environment` | string | — | `prod` | `prod`, `staging`, `dev` |

---

## CORS

The Writer service must accept requests from your frontend's origin. Configure it via the `CORS_ALLOWED_ORIGINS` environment variable:

```bash
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

## Attaching user context

```typescript
// After the user logs in:
BatAuditBrowser.setUser({
  identifier: user.id,
  userEmail: user.email,
  userName: user.name,
})

// On logout:
BatAuditBrowser.clearUser()
```

---

## Disabling for specific requests

```typescript
// Requests with this header are not intercepted
fetch('/api/health', {
  headers: { 'X-BatAudit-Skip': '1' }
})
```
