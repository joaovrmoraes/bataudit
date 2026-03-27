# Reader

HTTP API responsible for querying and serving audit events to the frontend dashboard and external consumers.

> **Note:** The current implementation uses GraphQL (gqlgen). Phase 1 of the roadmap replaces it with a standard REST API using the existing `handler.go` — the REST routes are already implemented and ready.

## Responsibility

The Reader is a **read-only** service. It never receives or writes audit events — that is the Writer's job. It exposes the stored data for consumption by the dashboard and integrations.

```
Dashboard / Client → GET /audit → Reader → PostgreSQL
```

## Port

| Environment variable | Default |
|---|---|
| `API_READER_PORT` | `8082` |

## Endpoints (REST — post Phase 1)

### `GET /audit`

Returns a paginated list of audit events, ordered by most recent first.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "identifier": "user-123",
      "user_email": "user@example.com",
      "user_name": "John Doe",
      "method": "POST",
      "path": "/api/users",
      "status_code": 201,
      "service_name": "my-api",
      "timestamp": "2024-01-15T10:30:00Z",
      "response_time": 142
    }
  ],
  "pagination": {
    "page": 1,
    "totalPage": 10,
    "limit": 10,
    "totalItems": 98
  }
}
```

> The list endpoint returns `AuditSummary` objects — a subset of fields optimized for display. Full event details are available via the details endpoint.

---

### `GET /audit/:id`

Returns the complete details of a single audit event by ID.

**Response `200 OK`:** Full `Audit` object including `request_body`, `query_params`, `path_params`, `user_roles`, `ip`, `user_agent`, etc.

**Response `404 Not Found`:**

```json
{ "error": "Audit record not found" }
```

---

### Static frontend

In production, the Reader also serves the compiled frontend:

```
GET /app  →  frontend/dist/index.html
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `API_READER_PORT` | `8082` | Port the server listens on |
| `DB_DRIVER` | `postgres` | Database driver |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `DB_NAME` | — | Database name |

## Dependencies

- **PostgreSQL** — sole data source; the Reader has no connection to Redis

## Running locally

```bash
# Start dependencies
docker compose up -d postgres

# Run
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/reader
```
