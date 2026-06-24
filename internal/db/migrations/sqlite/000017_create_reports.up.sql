CREATE TABLE IF NOT EXISTS reports (
    id         TEXT PRIMARY KEY,
    project_id TEXT,
    name       TEXT NOT NULL,
    widgets    TEXT NOT NULL DEFAULT '[]',
    layout     TEXT NOT NULL DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports (project_id);
