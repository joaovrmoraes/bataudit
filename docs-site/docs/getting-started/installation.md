---
sidebar_position: 1
title: Installation
---

# Installation

BatAudit runs via Docker Compose. No other dependencies required.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2+
- A terminal

---

## One-command demo

The fastest way to see BatAudit running with realistic pre-loaded data:

```bash
git clone https://github.com/joaovrmoraes/bataudit.git
cd bataudit
docker compose -f docker-compose.demo.yml up
```

Once all services are healthy (about 30–60 seconds):

- **Dashboard:** http://localhost:8082/app
- **Login:** `demo@bataudit.dev` / `demo`

The demo includes 30 days of realistic audit events, anomaly alerts, orphan browser events, and a live event streamer that continuously generates new data.

---

## Production setup

For a real deployment, use the standard `docker-compose.yml`:

### 1. Clone and configure

```bash
git clone https://github.com/joaovrmoraes/bataudit.git
cd bataudit
cp .env.example .env
```

### 2. Edit `.env`

```bash
# Required — change these
JWT_SECRET=your-strong-random-secret-here
INITIAL_OWNER_EMAIL=you@yourdomain.com
INITIAL_OWNER_PASSWORD=your-secure-password
INITIAL_OWNER_NAME=Your Name

# Database (defaults work for local Docker)
DB_USER=batuser
DB_PASSWORD=batpassword
DB_NAME=batdb
```

### 3. Start services

```bash
docker compose up -d
```

### 4. Open the dashboard

Navigate to **http://localhost:8082/app** and log in with the credentials from your `.env`.

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Secret key for signing JWT tokens |
| `INITIAL_OWNER_EMAIL` | ✅ | — | Email for the first owner account |
| `INITIAL_OWNER_PASSWORD` | ✅ | — | Password for the first owner account |
| `INITIAL_OWNER_NAME` | ✅ | — | Display name for the first owner |
| `DB_HOST` | — | `postgres` | PostgreSQL host |
| `DB_PORT` | — | `5432` | PostgreSQL port |
| `DB_USER` | — | `batuser` | PostgreSQL user |
| `DB_PASSWORD` | — | `batpassword` | PostgreSQL password |
| `DB_NAME` | — | `batdb` | PostgreSQL database name |
| `REDIS_ADDRESS` | — | `redis:6379` | Redis address |
| `API_READER_PORT` | — | `8082` | Port for Reader service |
| `LOG_LEVEL` | — | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `GIN_MODE` | — | `release` | Gin mode: `debug` or `release` |
| `TIERING_RAW_DAYS` | — | `30` | Days to keep raw events |
| `TIERING_HOURLY_DAYS` | — | `365` | Days to keep hourly summaries |

---

## Services and ports

| Service | Port | Notes |
|---|---|---|
| Writer | `8081` | Event ingestion endpoint |
| Reader | `8082` | REST API + dashboard |
| PostgreSQL | `5432` | Internal only (not exposed by default) |
| Redis | `6379` | Internal only |

:::tip
In production, expose only ports `8081` and `8082` behind a reverse proxy (Nginx, Caddy, Traefik).
:::
