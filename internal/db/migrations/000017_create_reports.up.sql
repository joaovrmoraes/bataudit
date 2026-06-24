CREATE TABLE IF NOT EXISTS reports (
    id         TEXT PRIMARY KEY,
    project_id TEXT,
    name       TEXT NOT NULL,
    widgets    JSONB NOT NULL DEFAULT '[]',
    layout     JSONB NOT NULL DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports (project_id);
