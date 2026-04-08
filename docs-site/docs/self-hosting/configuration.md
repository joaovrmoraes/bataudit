---
sidebar_position: 1
title: Configuration
---

# Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit.

---

## Required variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for signing JWT tokens. Use a random 32+ character string. |
| `INITIAL_OWNER_EMAIL` | Email for the auto-created owner account on first startup |
| `INITIAL_OWNER_PASSWORD` | Password for the owner account |
| `INITIAL_OWNER_NAME` | Display name for the owner |

---

## Database

| Variable | Default | Description |
|---|---|---|
| `DB_DRIVER` | `postgres` | Database driver: `postgres` or `sqlite` |
| `DB_HOST` | `postgres` | PostgreSQL host (postgres only) |
| `DB_PORT` | `5432` | PostgreSQL port (postgres only) |
| `DB_USER` | `batuser` | PostgreSQL user (postgres only) |
| `DB_PASSWORD` | `batpassword` | PostgreSQL password (postgres only) |
| `DB_NAME` | `batdb` | PostgreSQL database name (postgres only) |
| `SQLITE_PATH` | `bataudit.db` | SQLite file path (sqlite only) |

See [PostgreSQL setup](./postgresql) and [SQLite setup](./sqlite) for driver-specific guides.

---

## Redis / Queue

| Variable | Default | Description |
|---|---|---|
| `REDIS_ADDRESS` | `redis:6379` | Redis host:port |
| `QUEUE_NAME` | `bataudit:events` | Redis queue key |

---

## Worker autoscaling

| Variable | Default | Description |
|---|---|---|
| `WORKER_INITIAL_COUNT` | `2` | Workers to start with |
| `WORKER_MIN_COUNT` | `2` | Minimum concurrent workers |
| `WORKER_MAX_COUNT` | `10` | Maximum concurrent workers |
| `ENABLE_AUTOSCALING` | `true` | Scale workers based on queue depth |
| `SCALE_UP_THRESHOLD` | `10` | Queue depth to trigger scale-up |
| `SCALE_DOWN_THRESHOLD` | `2` | Queue depth to trigger scale-down |
| `COOLDOWN_PERIOD` | `30s` | Minimum time between scaling events |

---

## API

| Variable | Default | Description |
|---|---|---|
| `API_READER_PORT` | `8082` | Reader/dashboard port |
| `GIN_MODE` | `release` | `debug` or `release` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

---

## Anomaly detection

| Variable | Default | Description |
|---|---|---|
| `ANOMALY_COOLDOWN` | `5m` | Cooldown between alerts for same rule+service |
| `ANOMALY_VOLUME_THRESHOLD` | `3.0` | Z-score threshold for volume spike |
| `ANOMALY_ERROR_RATE_THRESHOLD` | `20.0` | Error rate % threshold |
| `ANOMALY_BRUTE_FORCE_THRESHOLD` | `10` | 401 count for brute force detection |
| `ANOMALY_MASS_DELETE_THRESHOLD` | `50` | DELETE count for mass delete detection |
| `ANOMALY_SILENT_SERVICE_MINUTES` | `15` | Silence threshold in minutes |

---

## Data tiering

| Variable | Default | Description |
|---|---|---|
| `TIERING_RAW_DAYS` | `30` | Days to keep raw events |
| `TIERING_HOURLY_DAYS` | `365` | Days to keep hourly summaries |
| `TIERING_HOUR` | `2` | Hour (UTC) to run nightly aggregation |

---

## Notifications

| Variable | Default | Description |
|---|---|---|
| `VAPID_PUBLIC_KEY` | — | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | — | VAPID private key |
| `VAPID_SUBJECT` | — | `mailto:you@domain.com` |

Generate persistent VAPID keys (run once, add output to `.env`):
```bash
go run ./cmd/tools/gen-vapid
```

:::tip
Run this once and commit the generated values to your `.env` file. If `VAPID_PUBLIC_KEY` is missing, the Reader generates ephemeral keys on startup — subscribers created with those keys will break on restart.
:::
