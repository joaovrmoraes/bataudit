# Reader

HTTP API responsible for querying and serving audit data to the dashboard and external consumers.

> Requires JWT authentication on all routes except `/health` and `/docs`.

```
Dashboard / Client → JWT → Reader → PostgreSQL
```

## Port

| Environment variable | Default |
|---|---|
| `API_READER_PORT` | `8082` |

---

## Endpoints

All routes are prefixed with `/v1`. Authenticate with `Authorization: Bearer <token>`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/auth/login` | Obtain JWT token |
| `POST` | `/v1/auth/logout` | Invalidate session |
| `GET`  | `/v1/auth/me` | Current user info |
| `GET`  | `/v1/auth/projects` | List accessible projects |
| `POST` | `/v1/auth/projects` | Create project |
| `GET`  | `/v1/auth/projects/:id/members` | List project members |
| `POST` | `/v1/auth/projects/:id/members` | Add member by email |
| `PATCH`| `/v1/auth/projects/:id/members/:userId` | Update member role |
| `DELETE`| `/v1/auth/projects/:id/members/:userId` | Remove member |
| `GET`  | `/v1/auth/api-keys` | List API keys for a project |
| `POST` | `/v1/auth/api-keys` | Create API key (shown once) |
| `DELETE`| `/v1/auth/api-keys/:id` | Revoke API key |

### Audit

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/audit` | Paginated event list with filters + sorting |
| `GET` | `/v1/audit/stats` | Aggregated metrics (totals, error rates, p95, timeline) |
| `GET` | `/v1/audit/sessions` | Derived user sessions (30-min inactivity gap) |
| `GET` | `/v1/audit/:id` | Full detail of a single event |

#### `GET /v1/audit` — query parameters

| Parameter | Description |
|-----------|-------------|
| `page`, `limit` | Pagination |
| `project_id` | Filter by project |
| `service_name` | Filter by service |
| `identifier` | Filter by user/client ID |
| `method` | Filter by HTTP method |
| `status_code` | Filter by status code |
| `environment` | Filter by environment |
| `start_date`, `end_date` | ISO 8601 date range |
| `sort_by` | `timestamp` \| `status_code` \| `response_time` (default: `timestamp`) |
| `sort_order` | `asc` \| `desc` (default: `desc`) |

#### `GET /v1/audit/stats` — response

```json
{
  "total": 1200,
  "errors_4xx": 48,
  "errors_5xx": 6,
  "avg_response_time": 142.5,
  "p95_response_time": 890.0,
  "active_services": 4,
  "last_event_at": "2024-01-15T10:30:00Z",
  "by_service": [...],
  "by_status_class": { "2xx": 1146, "4xx": 48, "5xx": 6 },
  "by_method": { "GET": 800, "POST": 300, ... },
  "timeline": [{ "hour": "2024-01-15T09:00:00Z", "count": 120 }, ...]
}
```

### Other

| Path | Description |
|------|-------------|
| `GET /health` | Service health + DB status |
| `GET /docs/*` | Swagger UI (interactive API docs) |
| `GET /app` | Serves the compiled React dashboard |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `API_READER_PORT` | `8082` | Port |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `INITIAL_OWNER_EMAIL` | — | Auto-create owner on first startup |
| `INITIAL_OWNER_PASSWORD` | — | Auto-create owner on first startup |
| `INITIAL_OWNER_NAME` | `Admin` | Owner display name |
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
docker compose up -d postgres

JWT_SECRET=change-me \
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/reader
```

## Regenerating Swagger docs

```bash
swag init -g cmd/api/reader/main.go -o docs
```
