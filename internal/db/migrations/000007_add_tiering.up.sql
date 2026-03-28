CREATE TABLE audit_summaries (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMPTZ NOT NULL,
    period_type  VARCHAR(4)  NOT NULL CHECK (period_type IN ('hour', 'day')),
    project_id   TEXT        NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    status_2xx   BIGINT      NOT NULL DEFAULT 0,
    status_3xx   BIGINT      NOT NULL DEFAULT 0,
    status_4xx   BIGINT      NOT NULL DEFAULT 0,
    status_5xx   BIGINT      NOT NULL DEFAULT 0,
    avg_ms       FLOAT       NOT NULL DEFAULT 0,
    p95_ms       FLOAT       NOT NULL DEFAULT 0,
    event_count  BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_audit_summaries_unique
    ON audit_summaries (period_start, period_type, project_id, service_name);

CREATE INDEX idx_audit_summaries_lookup
    ON audit_summaries (project_id, period_type, period_start DESC);
