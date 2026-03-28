# BatAudit

> Lightweight, self-hosted audit logging platform — collect, store and query audit events from any application.

---

## What is BatAudit?

BatAudit is a self-hosted auditing solution built in Go with a React dashboard. Any application (regardless of language) sends HTTP events to the Writer; they are validated, sanitized, queued in Redis, persisted to PostgreSQL by the Worker, and instantly visible in the dashboard served by the Reader.

```
SDK / Application
      │
      ▼ POST /v1/audit  (X-API-Key)
┌──────────┐      ┌─────────┐      ┌────────────┐
│  Writer  │─────▶│  Redis  │─────▶│   Worker   │─────▶ PostgreSQL
│  :8081   │      │  queue  │      │ (consumer) │
└──────────┘      └─────────┘      └────────────┘
                                                          │
                                                          ▼
┌──────────┐      ┌────────────┐
│  Reader  │◀─────│ PostgreSQL │
│  :8082   │      └────────────┘
└──────────┘
      │
      ▼  JWT auth
Dashboard / Integrations
```

---

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| Writer  | 8081 | Receives events from SDKs (API Key auth), enqueues to Redis |
| Worker  | —    | Consumes Redis queue, persists to PostgreSQL |
| Reader  | 8082 | Serves dashboard + REST API (JWT auth) + Swagger UI |

---

## Running

### Prerequisites

- Docker + Docker Compose
- Go 1.24+
- Node.js 20+ with pnpm (frontend)

### Infrastructure only (postgres + redis)

```bash
docker compose up -d
```

### Full stack in Docker

```bash
docker compose -f docker-compose.services.yml up -d
```

### Locally (backend)

```bash
# Writer
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/writer

# Worker
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/worker

# Reader
JWT_SECRET=change-me \
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run ./cmd/api/reader
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev        # dev server at http://localhost:5173
pnpm build      # production build → dist/
```

### Seed (development data)

```bash
# Populates the database with ~3000 realistic audit events over 30 days
DB_HOST=localhost DB_USER=batuser DB_PASSWORD=batpassword DB_NAME=batdb \
  go run scripts/seed.go
```

---

## Initial setup

Set env vars to create the first owner account on startup:

```bash
INITIAL_OWNER_EMAIL=admin@example.com
INITIAL_OWNER_PASSWORD=changeme
INITIAL_OWNER_NAME=Admin
```

Or use the setup wizard on first access at `http://localhost:8082/app`.

---

## Makefile

```bash
make build-all     # Build Docker images
make run-infra     # Start Redis + PostgreSQL only
make run-services  # Start Writer + Worker + Reader
make run-all       # Start everything
make stop-all      # Stop all containers
make clean         # Remove Docker images
```

---

## API

All routes are prefixed with `/v1`.

| Auth method | Used by | Header |
|-------------|---------|--------|
| API Key     | Writer  | `X-API-Key: <key>` |
| JWT Bearer  | Reader  | `Authorization: Bearer <token>` |

Interactive docs available at `http://localhost:8082/docs/index.html` (Swagger UI).

---

## Project structure

```
bataudit/
├── cmd/
│   └── api/
│       ├── writer/       # Writer service entrypoint
│       ├── reader/       # Reader service entrypoint
│       └── worker/       # Worker service entrypoint
├── internal/
│   ├── audit/            # Core domain: model, repository, service, handler
│   │   ├── sanitizer.go  # XSS + sensitive data detection and masking
│   │   └── validator.go  # Custom field validators (IP, UUID, env, ...)
│   ├── auth/             # Auth domain: JWT, API keys, users, projects, members
│   ├── db/               # Database init + migrations
│   ├── queue/            # Redis queue abstraction
│   ├── worker/           # Queue consumer + autoscaler
│   ├── health/           # Health check endpoint
│   └── config/           # Env var helpers
├── docs/                 # Auto-generated Swagger (swaggo/swag)
├── frontend/             # React dashboard
├── scripts/
│   └── seed.go           # Development data seed script
└── docker-compose*.yml
```

---

## Tests

```bash
go test ./internal/audit/...
```

73 unit tests covering `sanitizer.go`, `validator.go`, and `service.go`.
