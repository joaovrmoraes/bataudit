ALTER TABLE audits ADD COLUMN session_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_audits_session_id ON audits(session_id) WHERE session_id IS NOT NULL;
