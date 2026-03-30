---
sidebar_position: 4
title: Anomalies
---

# Anomalies API

Anomaly detection runs automatically in the Worker. Alerts are stored as regular audit events with `event_type: "system.alert"`.

---

## GET /v1/audit/anomalies

List anomaly alerts.

**Auth:** JWT Bearer token required.

```bash
GET http://localhost:8082/v1/audit/anomalies
Authorization: Bearer <jwt>
```

Returns events where `event_type = "system.alert"`, sorted by timestamp descending.

---

## Alert structure

Each alert is an audit event with:

- `event_type`: `"system.alert"`
- `path`: the rule type (e.g. `"volume_spike"`)
- `identifier`: `"system"`
- `service_name`: the service that triggered the alert
- `request_body`: JSON object with rule-specific details

---

## Alert types

### `volume_spike`

Triggered when request volume deviates significantly from the baseline (z-score threshold).

```json
{
  "current_rate": 60,
  "baseline_mean": 5.1,
  "z_score": 45.75,
  "threshold": 3.0
}
```

### `error_rate`

Triggered when the error rate (4xx + 5xx) exceeds the configured threshold within a sliding window.

```json
{
  "error_rate": 32.5,
  "threshold": 20.0,
  "errors": 13,
  "total": 40,
  "window_secs": 300
}
```

### `brute_force`

Triggered when the same `identifier` makes repeated `401` responses within a short window.

```json
{
  "identifier": "attacker_001",
  "count": 15,
  "window_secs": 300,
  "threshold": 10
}
```

### `mass_delete`

Triggered when a high number of `DELETE` requests are made within a short window.

```json
{
  "count": 62,
  "threshold": 50,
  "window_secs": 300
}
```

### `silent_service`

Triggered when a service that was previously active stops sending events for longer than the configured threshold.

```json
{
  "silence_minutes": 45,
  "threshold_minutes": 15,
  "last_event_at": "2024-01-15T13:00:00Z"
}
```

---

For configuration details, see [Anomaly Detection →](/concepts/anomaly-detection).
