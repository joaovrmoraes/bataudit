CREATE TABLE IF NOT EXISTS healthcheck_monitors (
    id               TEXT PRIMARY KEY,
    project_id       TEXT NOT NULL,
    name             TEXT NOT NULL,
    url              TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_seconds  INTEGER NOT NULL DEFAULT 10,
    expected_status  INTEGER NOT NULL DEFAULT 200,
    enabled          INTEGER NOT NULL DEFAULT 1,
    last_status      TEXT NOT NULL DEFAULT 'unknown',
    last_checked_at  DATETIME,
    created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at       DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS healthcheck_results (
    id          TEXT PRIMARY KEY,
    monitor_id  TEXT NOT NULL REFERENCES healthcheck_monitors(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    status_code INTEGER,
    response_ms INTEGER,
    error       TEXT,
    checked_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hc_monitors_project_id ON healthcheck_monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_hc_results_monitor_id  ON healthcheck_results(monitor_id);
CREATE INDEX IF NOT EXISTS idx_hc_results_checked_at  ON healthcheck_results(checked_at);
