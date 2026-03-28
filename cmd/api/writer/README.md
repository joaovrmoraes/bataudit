# Writer

HTTP API responsible for receiving audit events from SDKs, validating and sanitizing them, then enqueuing them to Redis for asynchronous processing.

> Authenticated by API Key (`X-API-Key` header). Never accepts JWT tokens.

```
SDK / Application → POST /v1/audit (X-API-Key) → Writer → Redis queue
```

## Port

| Environment variable | Default |
|---|---|
| `API_WRITER_PORT` | `8081` |

---

## Endpoints

### `POST /v1/audit`

Receives a new audit event.

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | API key tied to a project |

**Request body:**

```json
{
  "method": "POST",
  "path": "/api/users",
  "status_code": 201,
  "response_time": 142,
  "identifier": "user-123",
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "user_roles": ["admin"],
  "user_type": "admin",
  "tenant_id": "org-456",
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "request_id": "bat-abc123",
  "query_params": {},
  "path_params": {},
  "request_body": {},
  "error_message": "",
  "service_name": "my-api",
  "environment": "production",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Required fields:** `method`, `path`, `identifier`, `service_name`, `environment`, `timestamp`

**Accepted methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

**Accepted environments:** `production`, `staging`, `development`, `testing`, `local`

**Response `202 Accepted`:**

```json
{
  "message": "Audit received and will be processed",
  "status": "success",
  "audit_id": "uuid",
  "request_id": "bat-uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error codes:**

| Code | HTTP | Meaning |
|---|---|---|
| `BAT-001` | 400 | Invalid JSON format |
| `BAT-002` | 400 | Validation failed (missing/invalid fields) |
| `BAT-003` | 500 | Failed to enqueue — Redis unavailable |
| — | 401 | Missing or invalid API key |

---

### `GET /health`

Returns service health status.

---

## Data pipeline

Every event goes through these steps before being enqueued:

1. **API Key validation** — rejects unknown/expired/inactive keys with `401`
2. **JSON parsing** — rejects malformed bodies with `BAT-001`
3. **Timestamp** — defaults to `now()` if not provided
4. **Sanitization** — strips control characters, escapes HTML, normalizes strings
5. **Sensitive data detection** — scans `request_body` and `query_params` for credit card numbers, passwords (`password`, `passwd`, `pwd`, `secret`), API keys
6. **Masking** — replaces detected values with `********`
7. **Validation** — validates required fields, formats (email, IP, UUID), and value ranges
8. **ID generation** — generates `id` (UUID) and `request_id` (`bat-<uuid>`) if not provided
9. **Auto-project resolution** — resolves or creates a project from `service_name` + API key
10. **Enqueue** — pushes to Redis with a 5-second context timeout

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `API_WRITER_PORT` | `8081` | Port |
| `JWT_SECRET` | `change-me-in-production` | Used to verify API key middleware |
| `REDIS_ADDRESS` | `localhost:6379` | Redis connection |
| `DB_DRIVER` | `postgres` | `postgres` or `sqlite` |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_USER` | — | |
| `DB_PASSWORD` | — | |
| `DB_NAME` | — | |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

---

## Running locally

```bash
docker compose up -d postgres redis

JWT_SECRET=change-me \
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/writer
```
