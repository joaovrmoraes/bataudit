---
sidebar_position: 2
title: Data Tiering
---

# Data Tiering

BatAudit uses a three-tier storage model to keep historical data accessible without unbounded storage growth.

---

## Tiers

```
Raw events        →  stored for N days  (default: 30)
    ↓ aggregated nightly
Hourly summaries  →  stored for N days  (default: 365)
    ↓ aggregated nightly
Daily summaries   →  stored forever
```

### Raw events

Full event records with all fields. Used for detailed queries, event detail modals, and exports. Retained for `TIERING_RAW_DAYS` (default: 30 days).

### Hourly summaries

Per-service, per-hour aggregates: total requests, error counts, average response time, p95 response time. Retained for `TIERING_HOURLY_DAYS` (default: 365 days).

### Daily summaries

Per-service, per-day aggregates. Retained indefinitely — these are the long-term trend data.

---

## Configuration

```bash
TIERING_RAW_DAYS=30        # days to keep raw events
TIERING_HOURLY_DAYS=365    # days to keep hourly summaries
TIERING_HOUR=2             # hour of day (UTC) to run the aggregation job
```

---

## History endpoint

```bash
GET /v1/audit/stats/history?days=90
Authorization: Bearer <jwt>
```

Returns historical trend data using the appropriate tier for the requested time range:
- Last 30 days → raw events (full detail)
- 30–365 days → hourly summaries
- Beyond 365 days → daily summaries

The dashboard Retention page shows your current tiering configuration and storage usage.

---

## Storage estimate

A typical SaaS generating 10k events/day:

| Period | Tier | Approx. storage |
|---|---|---|
| Last 30 days | Raw events | ~150 MB |
| 30–365 days | Hourly summaries | ~5 MB |
| Beyond 1 year | Daily summaries | ~1 MB/year |

Total after 3 years: ~165 MB vs ~1.6 GB without tiering.
