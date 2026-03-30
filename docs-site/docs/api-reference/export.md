---
sidebar_position: 3
title: Export
---

# Export API

## GET /v1/audit/export

Export audit events as CSV or JSON. Supports the same filters as the list endpoint.

**Auth:** JWT Bearer token required.

**Limit:** 100 000 events per export.

---

## CSV export

```bash
GET http://localhost:8082/v1/audit/export?format=csv&service_name=payments-service&start_date=2024-01-01T00:00:00Z
Authorization: Bearer <jwt>
```

Returns a `text/csv` file with one row per event.

---

## JSON export

```bash
GET http://localhost:8082/v1/audit/export?format=json&environment=production
Authorization: Bearer <jwt>
```

Returns a `application/json` array of event objects.

---

## Query parameters

| Param | Type | Description |
|---|---|---|
| `format` | string | `csv` or `json` (default: `csv`) |
| `project_id` | string | Filter by project |
| `service_name` | string | Filter by service |
| `method` | string | Filter by HTTP method |
| `status_code` | int | Filter by status code |
| `environment` | string | Filter by environment |
| `identifier` | string | Filter by user/client ID |
| `start_date` | ISO 8601 | Events from this date |
| `end_date` | ISO 8601 | Events until this date |
| `event_type` | string | `http` or `system.alert` |

---

## Dashboard export

The Events page in the dashboard includes a **Download** button that triggers a CSV export with all active filters applied.
