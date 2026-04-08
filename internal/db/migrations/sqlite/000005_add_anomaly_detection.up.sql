ALTER TABLE audits ADD COLUMN event_type VARCHAR(32) NOT NULL DEFAULT 'http';

CREATE TABLE anomaly_rules (
    id             TEXT        PRIMARY KEY,
    project_id     VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rule_type      VARCHAR(32) NOT NULL,
    threshold      FLOAT       NOT NULL,
    window_seconds INT         NOT NULL DEFAULT 300,
    active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anomaly_rules_project ON anomaly_rules(project_id);
CREATE INDEX idx_audits_event_type ON audits(event_type);
