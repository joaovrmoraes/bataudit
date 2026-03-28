-- Add event_type to distinguish system events from regular HTTP audit events
ALTER TABLE audits ADD COLUMN event_type VARCHAR(32) NOT NULL DEFAULT 'http';

-- Anomaly detection rules per project
CREATE TABLE anomaly_rules (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rule_type      VARCHAR(32)  NOT NULL,
    threshold      FLOAT        NOT NULL,
    window_seconds INT          NOT NULL DEFAULT 300,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomaly_rules_project ON anomaly_rules(project_id);
CREATE INDEX idx_audits_event_type ON audits(event_type);
