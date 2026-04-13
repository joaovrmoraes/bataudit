CREATE INDEX IF NOT EXISTS idx_audits_project_timestamp      ON audits (project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_project_service        ON audits (project_id, service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_project_status         ON audits (project_id, status_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_project_identifier     ON audits (project_id, identifier, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_project_env_timestamp  ON audits (project_id, environment, timestamp DESC);
