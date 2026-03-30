---
sidebar_position: 1
title: Events
---

# Events API

## POST /v1/audit

Ingest a new audit event.

**Auth:** `X-API-Key` header required.

```bash
POST http://localhost:8081/v1/audit
X-API-Key: bat_your_api_key
Content-Type: application/json
```

**Request body:**

```json
{
  "path": "/api/users/42",
  "method": "PUT",
  "status_code": 200,
  "response_time": 87,
  "identifier": "user-123",
  "user_email": "alice@acme.com",
  "user_name": "Alice Silva",
  "user_roles": ["admin"],
  "service_name": "users-api",
  "environment": "production",
  "tenant_id": "org-456",
  "ip": "203.0.113.10",
  "request_body": { "name": "Alice S." }
}
```

**Responses:**

| Code | Description |
|---|---|
| `202` | Event accepted and queued |
| `400` | Validation error — check response body for details |
| `401` | Invalid or missing API key |

---

## GET /v1/audit

List audit events with optional filters.

**Auth:** JWT Bearer token required.

```bash
GET http://localhost:8082/v1/audit?service_name=users-api&status_code=500&limit=50
Authorization: Bearer <jwt>
```

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 100) |
| `project_id` | string | Filter by project |
| `service_name` | string | Filter by service |
| `method` | string | Filter by HTTP method |
| `status_code` | int | Filter by status code |
| `environment` | string | Filter by environment |
| `identifier` | string | Filter by user/client ID |
| `start_date` | ISO 8601 | Events from this date |
| `end_date` | ISO 8601 | Events until this date |
| `sort_by` | string | Field to sort by (default: `timestamp`) |
| `sort_order` | string | `asc` or `desc` (default: `desc`) |
| `event_type` | string | `http` or `system.alert` |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "http",
      "method": "PUT",
      "path": "/api/users/42",
      "status_code": 200,
      "response_time": 87,
      "identifier": "user-123",
      "user_email": "alice@acme.com",
      "service_name": "users-api",
      "environment": "production",
      "timestamp": "2024-01-15T14:32:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 1432,
    "totalPage": 72
  }
}
```

---

## GET /v1/audit/:id

Get the full detail of a single event, including `request_body`, `query_params`, `path_params`, `user_agent`, and all metadata.

**Auth:** JWT Bearer token required.

```bash
GET http://localhost:8082/v1/audit/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <jwt>
```

---

## GET /v1/audit/stats

Returns aggregate metrics for the current project.

**Auth:** JWT Bearer token required.

**Response:**

```json
{
  "total": 14320,
  "errors_4xx": 423,
  "errors_5xx": 12,
  "avg_response_time": 94.3,
  "p95_response_time": 412.0,
  "active_services": 4,
  "last_event_at": "2024-01-15T14:32:00Z",
  "by_service": [...],
  "by_status_class": { "2xx": 13885, "4xx": 423, "5xx": 12 },
  "by_method": { "GET": 9200, "POST": 3100, "PUT": 1800, "DELETE": 220 },
  "timeline": [...]
}
```

---

## GET /v1/audit/orphans

Returns browser-side events with no matching backend response. Requires the [Browser SDK](/sdks/browser).

**Auth:** JWT Bearer token required.
