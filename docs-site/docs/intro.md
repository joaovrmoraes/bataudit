---
slug: /intro
sidebar_position: 1
title: Introduction
---

# BatAudit

**Self-hosted audit logging for SaaS teams that need compliance without the enterprise bill.**

BatAudit records every HTTP event your application processes — who did what, on which resource, when, and with what result. It ships as a single `docker compose up` and runs entirely on your infrastructure.

---

## Why BatAudit

Most audit logging solutions fall into two camps:

- **Too expensive** — DataDog, Splunk, Sumo Logic charge per host or per GB and are built for enterprise teams
- **Wrong tool** — Sentry tracks errors, not audit trails. Building your own takes weeks

BatAudit fills the gap: a purpose-built audit log store that's easy to run, easy to query, and free to self-host.

| Feature | BatAudit | DataDog | Sentry |
|---|---|---|---|
| Audit logging | ✅ | Partial | ❌ |
| Self-hosted | ✅ | ❌ | ✅ |
| Anomaly detection | ✅ | ✅ | ❌ |
| Open source | ✅ (MIT) | ❌ | Partial |
| Price | Free | $15+/host/mo | $26+/mo |

---

## What it does

- **Ingests** HTTP events via REST API or SDK, validates and queues them instantly
- **Stores** events in PostgreSQL with full metadata: user, IP, method, path, status, response time, request body
- **Queries** events with filters: service, method, status code, identifier, date range, environment
- **Detects** anomalies automatically: volume spikes, error rate surges, brute-force attempts, mass deletions, silent services
- **Alerts** via Web Push (VAPID) and Webhooks (Discord, Slack, PagerDuty, n8n)
- **Exports** up to 100 000 events as CSV or JSON
- **Tiers** old data into hourly and daily summaries to keep storage costs flat

---

## Architecture

```
SDK / App  →  Writer :8081  →  Redis  →  Worker  →  PostgreSQL
                                                          ↓
                                                    Reader :8082
                                                          ↓
                                                    Dashboard
```

| Service | Port | Role |
|---|---|---|
| **Writer** | 8081 | Receives events, validates, enqueues |
| **Worker** | — | Consumes queue, persists, runs anomaly detection |
| **Reader** | 8082 | REST API + serves dashboard |

---

## Next steps

- [Install BatAudit →](/getting-started/installation)
- [Send your first event →](/getting-started/first-event)
- [Node.js SDK →](/sdks/nodejs)
