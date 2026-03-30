---
sidebar_position: 2
title: Your First Event
---

# Your First Event

After BatAudit is running, you need an API key to start sending events.

---

## 1. Create an API key

1. Open the dashboard at http://localhost:8082/app
2. Go to **Settings → API Keys**
3. Click **Generate new key**
4. Copy the key — it's only shown once

:::warning
Store the API key immediately. BatAudit stores a SHA-256 hash of the key, not the key itself, so it cannot be retrieved later.
:::

---

## 2. Send an event via curl

```bash
curl -X POST http://localhost:8081/v1/audit \
  -H "X-API-Key: bat_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "status_code": 200,
    "response_time": 45,
    "identifier": "user-123",
    "service_name": "my-api",
    "environment": "production"
  }'
```

A successful response returns `202 Accepted`.

---

## 3. View the event in the dashboard

Open the dashboard and navigate to **Events**. Your event should appear immediately (the Worker processes the queue in real-time).

---

## Event fields reference

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | ✅ | Request path (max 255 chars) |
| `method` | string | ✅ | HTTP method: `GET`, `POST`, `PUT`, `DELETE` |
| `status_code` | int | — | HTTP status code (100–599) |
| `response_time` | int | — | Response time in milliseconds |
| `identifier` | string | ✅ | User or client ID (max 100 chars) |
| `service_name` | string | ✅ | Name of the service sending the event |
| `environment` | string | ✅ | `production`, `staging`, `development` |
| `user_email` | string | — | User email address |
| `user_name` | string | — | User display name |
| `user_roles` | array | — | Array of role strings |
| `user_type` | string | — | e.g. `admin`, `viewer` |
| `tenant_id` | string | — | Organization/tenant ID for multi-tenant apps |
| `ip` | string | — | Client IP address |
| `user_agent` | string | — | User-Agent header |
| `request_id` | string | — | Trace/correlation ID |
| `query_params` | object | — | URL query parameters |
| `path_params` | object | — | URL path parameters |
| `request_body` | object | — | Request body (opt-in via SDK) |
| `error_message` | string | — | Error description for failed requests |
| `session_id` | string | — | Explicit session ID for session tracking |
| `source` | string | — | `backend` (default) or `browser` |

---

## Sensitive data masking

BatAudit automatically masks the following patterns in `request_body` and `query_params` before storing:

- Credit card numbers → `************1234`
- Fields named `password`, `secret`, `pwd` → `"password":"********"`
- API keys and tokens → `"token":"********"`

This runs server-side — you don't need to sanitize before sending.

---

## Next steps

- [Use the Node.js SDK](/sdks/nodejs) to instrument your Express or Fastify app automatically
- [Explore the dashboard](/getting-started/dashboard)
