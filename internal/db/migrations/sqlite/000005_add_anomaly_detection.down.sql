DROP INDEX IF EXISTS idx_audits_event_type;
DROP INDEX IF EXISTS idx_anomaly_rules_project;
DROP TABLE IF EXISTS anomaly_rules;
ALTER TABLE audits DROP COLUMN event_type;
