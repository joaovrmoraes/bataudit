---
sidebar_position: 4
title: Healthcheck Monitor
---

# Healthcheck Monitor

BatAudit pings your service URLs on a schedule and tracks their uptime — closing the loop between "what happened" (audit log) and "is the app still running" (uptime).

When a service goes down or comes back up, BatAudit records the transition as an audit event and fires your configured notifications (Web Push + Webhook).

---

## How it works

1. You register a URL and a polling interval per project (e.g. `https://api.yourapp.com/health` every 60s)
2. The **Worker** service pings each URL using an HTTP GET with your configured timeout
3. The response status code is compared against the expected status (default: `200`)
4. On a **UP → DOWN** or **DOWN → UP** transition, BatAudit:
   - Records a `system.healthcheck.down` or `system.healthcheck.up` event in the audit log
   - Sends a notification via all active channels (Web Push, Webhook)
5. Results are stored and visible as a history chart per monitor

Notifications fire **only on transitions** — not on every failed check — so you won't get spammed.

---

## Setup

1. Open **Settings → Healthcheck** in the dashboard
2. Select a project (required — monitors are per-project)
3. Click **Add monitor**
4. Fill in:
   - **Name** — e.g. `API Health`, `Payments Service`
   - **URL** — the endpoint to ping (must return HTTP, not HTTPS on localhost in dev)
   - **Interval** — how often to check, in seconds (minimum: 10s, default: 60s)
   - **Timeout** — how long to wait for a response (default: 10s)
   - **Expected status** — the HTTP status code that means "healthy" (default: 200)

---

## Dashboard integration

### Service breakdown table

The **Dashboard** service table gains a **Health** column showing the status of the monitor whose name matches the `service_name`:

| Status | Display |
|---|---|
| UP | Green dot + "UP" |
| DOWN | Red dot + "DOWN" |
| No monitor | — |

The monitor **Name** field should match the `service_name` sent by your SDK for the column to link them automatically.

### Down banner

When any monitor is **DOWN**, a red alert banner appears at the top of the dashboard listing the affected services and their URLs.

In **All Projects** view, the Healthcheck settings page shows all DOWN monitors across every project in read-only mode.

---

## Monitor actions

| Action | Description |
|---|---|
| Toggle | Pause or resume periodic checks without deleting the monitor |
| Edit | Update name, URL, interval, timeout, or expected status |
| Test now | Run an immediate check and see the result inline |
| History | Expand the row to see the last 50 check results |
| Delete | Remove the monitor permanently |

---

## Audit events

Every UP/DOWN transition creates an event in the audit log:

### `system.healthcheck.down`

```json
{
  "event_type": "system.healthcheck.down",
  "service_name": "API Health",
  "path": "https://api.yourapp.com/health",
  "request_body": {
    "url": "https://api.yourapp.com/health",
    "expected_status": 200,
    "status_code": 503,
    "response_ms": 142,
    "error": "expected 200, got 503"
  }
}
```

### `system.healthcheck.up`

```json
{
  "event_type": "system.healthcheck.up",
  "service_name": "API Health",
  "path": "https://api.yourapp.com/health",
  "request_body": {
    "url": "https://api.yourapp.com/health",
    "status_code": 200,
    "response_ms": 98,
    "downtime_seconds": 312
  }
}
```

---

## API reference

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

### List monitors

```http
GET /v1/monitors?project_id=<id>
```

Omit `project_id` to list monitors across all projects.

### Create monitor

```http
POST /v1/monitors
Content-Type: application/json

{
  "project_id": "uuid",
  "name": "API Health",
  "url": "https://api.yourapp.com/health",
  "interval_seconds": 60,
  "timeout_seconds": 10,
  "expected_status": 200
}
```

Maximum **10 monitors per project**.

### Update monitor

```http
PUT /v1/monitors/:id
Content-Type: application/json

{
  "enabled": false
}
```

All fields are optional — only provided fields are updated.

### Delete monitor

```http
DELETE /v1/monitors/:id
```

### Check history

```http
GET /v1/monitors/:id/history?limit=50
```

Returns the last N results (max 200).

### Test now

```http
POST /v1/monitors/:id/test
```

Runs an immediate check and returns the result without persisting it.

---

## Limits

| Limit | Value |
|---|---|
| Monitors per project | 10 |
| Minimum interval | 10 seconds |
| History kept per monitor | 200 results |
| HTTP method used | GET |
