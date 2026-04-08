---
sidebar_position: 2
title: Production Deployment
---

# Production Deployment

This guide covers deploying BatAudit on a Linux server (VPS, EC2, bare metal) using Docker Compose with PostgreSQL. For a simpler single-file setup, see the [SQLite guide](./sqlite).

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A domain name pointing to your server
- A reverse proxy (Caddy or Nginx) for HTTPS

---

## 1. Clone and configure

```bash
git clone https://github.com/joaovrmoraes/bataudit.git
cd bataudit
cp .env.example .env   # or create .env from scratch
```

Edit `.env` with production values:

```env
# Auth
JWT_SECRET=<random 32+ char string>
INITIAL_OWNER_NAME=Your Name
INITIAL_OWNER_EMAIL=you@yourdomain.com
INITIAL_OWNER_PASSWORD=<strong password>

# Database (PostgreSQL)
DB_DRIVER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=batuser
DB_PASSWORD=<strong password>
DB_NAME=batdb

# Redis
REDIS_ADDRESS=redis:6379
QUEUE_NAME=bataudit:events

# Runtime
GIN_MODE=release
LOG_LEVEL=info

# Web Push (optional — generate with: go run ./cmd/tools/gen-vapid)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@yourdomain.com
```

Generate a strong `JWT_SECRET`:
```bash
openssl rand -base64 32
```

Generate VAPID keys for Web Push notifications:
```bash
go run ./cmd/tools/gen-vapid
```

---

## 2. Start the stack

```bash
docker compose up -d
```

Services start in order: PostgreSQL → Redis → Writer → Reader + Worker. Migrations run automatically on first startup.

Verify everything is up:
```bash
docker compose ps
curl http://localhost:8082/health
```

---

## 3. Reverse proxy (HTTPS)

Never expose PostgreSQL or Redis ports publicly. Only proxy ports `8081` (Writer API) and `8082` (Reader + dashboard).

### Caddy

```caddy
bataudit.yourdomain.com {
    reverse_proxy localhost:8082
}

writer.bataudit.yourdomain.com {
    reverse_proxy localhost:8081
}
```

Caddy handles TLS automatically via Let's Encrypt.

### Nginx + Certbot

```nginx
server {
    listen 443 ssl;
    server_name bataudit.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/bataudit.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bataudit.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:8082;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name writer.bataudit.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/writer.bataudit.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/writer.bataudit.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:8081;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Coolify

BatAudit ships with `docker-compose.coolify.yml` for one-click Coolify deploys.

1. Create a new resource → **Docker Compose**
2. Paste `docker-compose.coolify.yml`
3. Set environment variables in Coolify's UI
4. Deploy

---

## 5. Health checks

Both services expose `/health`:

```bash
curl http://localhost:8081/health   # Writer
curl http://localhost:8082/health   # Reader
# → {"status":"ok"}
```

---

## 6. Backups

```bash
# Dump PostgreSQL to file
docker exec bat_postgres pg_dump -U batuser batdb > backup-$(date +%Y%m%d).sql

# Restore
cat backup-20260101.sql | docker exec -i bat_postgres psql -U batuser batdb
```

For automated backups, pipe `pg_dump` to S3, R2, or Backblaze on a cron schedule.

---

## 7. Upgrading

```bash
git pull origin main
docker compose pull
docker compose up -d
```

Migrations run automatically on startup — no manual steps required.

---

## Security checklist

- [ ] `JWT_SECRET` is a strong random value (≥32 chars), not the default
- [ ] `INITIAL_OWNER_PASSWORD` changed from default
- [ ] Only ports `8081` and `8082` exposed — PostgreSQL and Redis are internal only
- [ ] HTTPS enabled via reverse proxy
- [ ] `GIN_MODE=release`
- [ ] VAPID keys are persistent (set in `.env`, not ephemeral)
- [ ] `.env` not committed to git (add to `.gitignore`)
- [ ] PostgreSQL backups scheduled
