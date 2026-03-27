# Writer

HTTP API responsible for receiving audit events, validating and sanitizing them, then enqueuing them to Redis for asynchronous processing.

## Responsibility

The Writer is the **entry point** for all audit data. It is the only service that accepts writes from external clients (SDKs, integrations). It never writes directly to the database — it delegates persistence to the Worker via a Redis queue.

```
Client → POST /audit → Writer → Redis queue
```

## Port

| Environment variable | Default |
|---|---|
| `API_WRITER_PORT` | `8081` |

## Endpoints

### `POST /audit`

Receives a new audit event.

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

**Accepted methods:** `GET`, `POST`, `PUT`, `DELETE`

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
| `BAT-003` | 500 | Failed to enqueue the event to Redis |

---

### `GET /health`

Returns the health status of the service and its dependencies.

```json
{
  "status": "OK",
  "api_response_ms": 1,
  "db_response_ms": 3,
  "db_status": "connected",
  "environment": "development",
  "version": "1.0.0"
}
```

## Data pipeline before enqueue

Every event goes through these steps before being enqueued:

1. **JSON parsing** — validates that the body is valid JSON
2. **Timestamp** — if not provided, sets `timestamp = now()`
3. **Sanitization** — strips control characters, escapes HTML, normalizes strings
4. **Sensitive data detection** — scans `request_body` and `query_params` for patterns matching credit card numbers, passwords, API keys
5. **Masking** — if sensitive data is detected, replaces values with `********`
6. **Validation** — validates required fields, formats (email, IP, UUID), and value ranges
7. **ID generation** — generates `id` (UUID) and `request_id` (`bat-<uuid>`) if not provided
8. **Enqueue** — serializes to JSON and pushes to Redis with a 5-second timeout

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `API_WRITER_PORT` | `8081` | Port the server listens on |
| `REDIS_ADDRESS` | `localhost:6379` | Redis connection address |
| `DB_DRIVER` | `postgres` | Database driver |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `DB_NAME` | — | Database name |
| `GIN_MODE` | `debug` | Gin mode (`debug` or `release`) |

## Dependencies

- **PostgreSQL** — used for auto-migration on startup and health checks
- **Redis** — target queue for audit events (`bataudit:events`)

Both connections are retried up to 5 times with a 5-second interval before the service exits.

## Running locally

```bash
# Start dependencies
docker compose up -d postgres redis

# Run
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/writer
```
