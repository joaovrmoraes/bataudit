CREATE TABLE IF NOT EXISTS wallboard_tokens (
    id           TEXT        PRIMARY KEY,
    project_id   TEXT,
    code         TEXT        NOT NULL UNIQUE,
    refresh_hash TEXT        NOT NULL,
    expires_at   DATETIME    NOT NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallboard_tokens_code ON wallboard_tokens (code);
