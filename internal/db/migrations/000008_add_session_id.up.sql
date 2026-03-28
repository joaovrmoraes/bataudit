ALTER TABLE audits ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_audits_session_id ON audits(session_id) WHERE session_id IS NOT NULL;
