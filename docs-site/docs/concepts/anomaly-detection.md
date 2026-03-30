---
sidebar_position: 1
title: Anomaly Detection
---

# Anomaly Detection

BatAudit detects anomalies automatically using statistical methods — no external ML services, no model training, no cloud dependencies.

The anomaly engine runs inside the Worker process and evaluates every batch of incoming events.

---

## Detectors

### Volume Spike (Z-score)

Monitors the rate of incoming events per service and computes a z-score against a rolling baseline. If the z-score exceeds the threshold (default: 3.0), a `volume_spike` alert is generated.

This catches sudden traffic bursts — load attacks, runaway retry loops, or misconfigured clients.

**Configuration:**
```bash
ANOMALY_VOLUME_THRESHOLD=3.0       # z-score threshold
ANOMALY_VOLUME_WINDOW=300          # sliding window in seconds
```

### Error Rate

Tracks the ratio of 4xx + 5xx responses within a sliding window. If the error rate exceeds the threshold (default: 20%), an `error_rate` alert is generated.

Useful for detecting deployment failures, downstream service degradation, or sudden spikes in bad requests.

**Configuration:**
```bash
ANOMALY_ERROR_RATE_THRESHOLD=20.0  # percentage
ANOMALY_ERROR_RATE_WINDOW=300      # sliding window in seconds
```

### Brute Force

Detects when the same `identifier` produces repeated `401` responses in a short period (default: 10 failures in 5 minutes). Generates a `brute_force` alert.

**Configuration:**
```bash
ANOMALY_BRUTE_FORCE_THRESHOLD=10   # failure count
ANOMALY_BRUTE_FORCE_WINDOW=300     # window in seconds
```

### Mass Delete

Triggers when a high number of `DELETE` requests are made within a short window (default: 50 in 5 minutes). Useful for detecting accidental bulk deletes or malicious data deletion.

**Configuration:**
```bash
ANOMALY_MASS_DELETE_THRESHOLD=50   # request count
ANOMALY_MASS_DELETE_WINDOW=300     # window in seconds
```

### Silent Service

Triggers when a service that was active stops sending events for longer than the threshold (default: 15 minutes). Detects crashed services, broken deployments, or network partitions that prevent events from reaching BatAudit.

**Configuration:**
```bash
ANOMALY_SILENT_SERVICE_MINUTES=15  # silence threshold in minutes
```

---

## Alert cooldown

To avoid alert storms, each rule has a cooldown period. A rule won't fire again for the same service until the cooldown expires.

```bash
ANOMALY_COOLDOWN=5m   # default cooldown between alerts for the same rule+service
```

The demo uses `ANOMALY_COOLDOWN=1m` so alerts are visible quickly.

---

## Viewing alerts

Alerts appear in:
- **Dashboard → Anomalies** page
- **Notifications** (Web Push + Webhooks, if configured)
- **API:** `GET /v1/audit/anomalies`
- **Events list:** filter by `event_type=system.alert`
