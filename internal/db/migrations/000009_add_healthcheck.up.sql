CREATE TABLE IF NOT EXISTS healthcheck_monitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,
    interval_seconds INT NOT NULL DEFAULT 60,
    timeout_seconds  INT NOT NULL DEFAULT 10,
    expected_status  INT NOT NULL DEFAULT 200,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_status     VARCHAR(10) NOT NULL DEFAULT 'unknown',
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS healthcheck_results (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id  UUID NOT NULL REFERENCES healthcheck_monitors(id) ON DELETE CASCADE,
    status      VARCHAR(10) NOT NULL,
    status_code INT,
    response_ms BIGINT,
    error       TEXT,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_monitors_project_id ON healthcheck_monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_hc_results_monitor_id  ON healthcheck_results(monitor_id);
CREATE INDEX IF NOT EXISTS idx_hc_results_checked_at  ON healthcheck_results(checked_at DESC);
