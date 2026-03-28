DROP INDEX IF EXISTS idx_audits_session_id;
ALTER TABLE audits DROP COLUMN IF EXISTS session_id;
