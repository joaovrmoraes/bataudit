DROP INDEX IF EXISTS idx_audits_session_id;
ALTER TABLE audits DROP COLUMN session_id;
