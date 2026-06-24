-- Read-only role for the SQL Query Console / Studio.
--
-- Defense model:
--   * Writes are ALWAYS blocked because every query runs inside a
--     `BEGIN READ ONLY` transaction (enforced by the app, regardless of role).
--   * Read scope (e.g. hiding the users table) is additionally enforced by
--     running the user's query under this NOLOGIN role via `SET LOCAL ROLE`.
--
-- This is best-effort: creating a role needs CREATEROLE/superuser. When the
-- migrating user lacks it (e.g. a locked-down app user), this is skipped and the
-- console still blocks writes via the READ ONLY transaction — only the extra
-- read-scoping is unavailable until a DBA provisions the role. No password is
-- used (NOLOGIN), so there is no second connection to manage.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bataudit_readonly') THEN
        CREATE ROLE bataudit_readonly NOLOGIN;
    END IF;

    GRANT USAGE ON SCHEMA public TO bataudit_readonly;
    GRANT SELECT ON audits TO bataudit_readonly;
    GRANT SELECT ON audit_summaries TO bataudit_readonly;

    -- Let the app's own role switch into the read-only role with SET ROLE.
    EXECUTE format('GRANT bataudit_readonly TO %I', current_user);
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'bataudit_readonly: insufficient privilege, skipping (queries still blocked from writing via READ ONLY transaction)';
    WHEN undefined_table THEN
        RAISE NOTICE 'bataudit_readonly: a target table is missing, skipping its grant';
END$$;
