-- SQLite has no roles. The Query Console relies on SELECT-only validation and a
-- read-only transaction on the main connection. No-op migration to keep the
-- migration sequence aligned with PostgreSQL.
SELECT 1;
