ALTER TABLE audits ADD COLUMN project_id VARCHAR(64) REFERENCES projects(id);
