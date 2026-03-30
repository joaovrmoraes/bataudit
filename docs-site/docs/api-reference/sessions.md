---
sidebar_position: 2
title: Sessions
---

# Sessions API

BatAudit provides two session models: **derived sessions** (automatic) and **explicit sessions** (opt-in).

---

## Derived sessions

BatAudit automatically groups events from the same `identifier` into sessions using a **30-minute inactivity gap**. A new session starts when more than 30 minutes pass since the user's last event.

### GET /v1/audit/sessions

List all derived sessions.

**Auth:** JWT Bearer token required.

```bash
GET http://localhost:8082/v1/audit/sessions?identifier=user-123
Authorization: Bearer <jwt>
```

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `identifier` | string | Filter by user/client ID |
| `service_name` | string | Filter by service |
| `start_date` | ISO 8601 | Sessions starting from |
| `end_date` | ISO 8601 | Sessions starting until |

**Response:**

```json
[
  {
    "identifier": "user-123",
    "service_name": "my-api",
    "session_start": "2024-01-15T09:12:00Z",
    "session_end": "2024-01-15T09:47:23Z",
    "duration_seconds": 2123,
    "event_count": 34
  }
]
```

---

## Explicit sessions

For finer control, send a `session_id` field with your events. This lets you track sessions that span multiple services or that you want to look up directly.

### Sending an event with a session ID

```json
{
  "path": "/api/checkout",
  "method": "POST",
  "status_code": 200,
  "identifier": "user-123",
  "service_name": "orders-api",
  "environment": "production",
  "session_id": "checkout-session-abc123"
}
```

### GET /v1/audit/sessions/:session_id

Get all events that belong to a specific explicit session.

**Auth:** JWT Bearer token required.

```bash
GET http://localhost:8082/v1/audit/sessions/checkout-session-abc123
Authorization: Bearer <jwt>
```

**Response:**

```json
{
  "session_id": "checkout-session-abc123",
  "identifier": "user-123",
  "service_name": "orders-api",
  "session_start": "2024-01-15T14:00:00Z",
  "session_end": "2024-01-15T14:08:42Z",
  "duration_seconds": 522,
  "event_count": 8,
  "events": [
    {
      "id": "uuid",
      "method": "GET",
      "path": "/api/cart",
      "status_code": 200,
      "timestamp": "2024-01-15T14:00:01Z"
    }
  ]
}
```
