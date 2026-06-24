DO $$
BEGIN
    REVOKE ALL ON audits FROM bataudit_readonly;
    REVOKE ALL ON audit_summaries FROM bataudit_readonly;
    REVOKE USAGE ON SCHEMA public FROM bataudit_readonly;
    DROP ROLE IF EXISTS bataudit_readonly;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'bataudit_readonly teardown skipped: %', SQLERRM;
END$$;
