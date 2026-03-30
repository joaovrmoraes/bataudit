---
sidebar_position: 2
title: Production Deployment
---

# Production Deployment

## Docker Compose (recommended)

```bash
git clone https://github.com/joaovrmoraes/bataudit.git
cd bataudit
cp .env.example .env
# edit .env with your values
docker compose up -d
```

---

## Reverse proxy

Only expose ports `8081` (Writer) and `8082` (Reader/dashboard) behind a reverse proxy. Never expose PostgreSQL or Redis directly.

### Caddy example

```caddy
bataudit.yourdomain.com {
    reverse_proxy localhost:8082
}

writer.bataudit.yourdomain.com {
    reverse_proxy localhost:8081
}
```

### Nginx example

```nginx
server {
    listen 443 ssl;
    server_name bataudit.yourdomain.com;

    location / {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Coolify

BatAudit ships with a `docker-compose.coolify.yml` that uses Coolify-compatible service names and environment variable injection.

1. Create a new resource in Coolify → **Docker Compose**
2. Paste the contents of `docker-compose.coolify.yml`
3. Set environment variables in Coolify's UI
4. Deploy

---

## Backups

Back up the PostgreSQL volume regularly:

```bash
docker exec bat_postgres pg_dump -U batuser batdb > backup-$(date +%Y%m%d).sql
```

Or use a scheduled job with `pg_dump` piped to S3/R2/Backblaze.

---

## Health checks

Both services expose a `/health` endpoint:

```bash
curl http://localhost:8081/health   # Writer
curl http://localhost:8082/health   # Reader
```

Response: `{"status":"ok"}`

---

## Security checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change `INITIAL_OWNER_PASSWORD` from default
- [ ] Expose only ports 8081 and 8082 (not 5432, 6379)
- [ ] Use HTTPS via reverse proxy
- [ ] Set `GIN_MODE=release`
- [ ] Configure persistent VAPID keys if using Web Push
- [ ] Enable PostgreSQL backups
- [ ] Restrict `DB_PASSWORD` and `JWT_SECRET` to environment variables, not committed to git

---

## Upgrading

```bash
git pull origin main
docker compose pull
docker compose up -d
```

Migrations run automatically on startup — no manual steps required.
