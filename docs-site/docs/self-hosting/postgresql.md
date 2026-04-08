---
sidebar_position: 3
title: PostgreSQL Setup
---

# PostgreSQL Setup

PostgreSQL is the recommended database for production BatAudit deployments. It handles concurrent writes from the Writer service, supports JSONB for structured audit payloads, and scales to millions of events without performance degradation.

---

## When to use PostgreSQL

| Scenario | Use |
|---|---|
| Production or staging server | ✅ PostgreSQL |
| Multiple concurrent SDKs writing events | ✅ PostgreSQL |
| Team with multiple users | ✅ PostgreSQL |
| Simple self-host, single user | ⚡ [SQLite](./sqlite) is simpler |
| Local development | ⚡ [SQLite](./sqlite) is simpler |

---

## Environment variables

```env
DB_DRIVER=postgres
DB_HOST=postgres        # Docker service name, or hostname of your DB server
DB_PORT=5432
DB_USER=batuser
DB_PASSWORD=<strong password>
DB_NAME=batdb
```

---

## Docker Compose (bundled)

The default `docker-compose.yml` includes a Bitnami PostgreSQL container:

```bash
git clone https://github.com/joaovrmoraes/bataudit.git
cd bataudit
cp .env.example .env
# edit .env — set DB_PASSWORD, JWT_SECRET, INITIAL_OWNER_PASSWORD
docker compose up -d
```

PostgreSQL data is stored in the `bat_pgdata` Docker volume and survives container restarts.

---

## External PostgreSQL

To connect to an existing PostgreSQL server instead of the bundled container, remove the `postgres` service from `docker-compose.yml` and update `.env`:

```env
DB_HOST=db.yourdomain.com
DB_PORT=5432
DB_USER=bataudit_user
DB_PASSWORD=<password>
DB_NAME=bataudit
```

BatAudit needs `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` permissions on the target database. Migrations run automatically on startup.

---

## Connection details

BatAudit connects with `sslmode=disable` by default. If your database requires SSL:

1. Pass the connection string directly by editing `internal/db/db.go` to add `sslmode=require` (or `verify-full`)
2. Or terminate TLS at a connection pooler (PgBouncer, RDS proxy)

---

## Backups

```bash
# Full dump
docker exec bat_postgres pg_dump -U batuser batdb > backup-$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i bat_postgres psql -U batuser batdb

# Automated daily backup (add to crontab)
0 3 * * * docker exec bat_postgres pg_dump -U batuser batdb | gzip > /backups/bataudit-$(date +\%Y\%m\%d).sql.gz
```

---

## Performance tips

For high-volume deployments (>100k events/day):

- **Indexes** — BatAudit creates indexes on `project_id`, `timestamp`, `service_name`, and `event_type` automatically via migrations
- **Connection pooling** — consider PgBouncer in front of PostgreSQL if you run many Writer replicas
- **Data tiering** — raw events are aggregated nightly into `audit_summaries` and pruned after `TIERING_RAW_DAYS` (default: 30 days). See [Data Tiering](../concepts/data-tiering)
