-- Core query pattern: filter by project_id, sort/filter by timestamp
CREATE INDEX IF NOT EXISTS idx_audits_project_timestamp      ON audits (project_id, timestamp DESC);

-- GetStats by service breakdown
CREATE INDEX IF NOT EXISTS idx_audits_project_service        ON audits (project_id, service_name, timestamp DESC);

-- Error rate queries (status_code filter + project)
CREATE INDEX IF NOT EXISTS idx_audits_project_status         ON audits (project_id, status_code, timestamp DESC);

-- Session / user queries
CREATE INDEX IF NOT EXISTS idx_audits_project_identifier     ON audits (project_id, identifier, timestamp DESC);

-- Environment filter (used in GetStats + List)
CREATE INDEX IF NOT EXISTS idx_audits_project_env_timestamp  ON audits (project_id, environment, timestamp DESC);
