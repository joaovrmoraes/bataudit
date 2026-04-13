CREATE TABLE IF NOT EXISTS wallboard_tokens (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       VARCHAR(255),                        -- NULL = all projects
    code             VARCHAR(20)  NOT NULL UNIQUE,        -- human-readable activation code (e.g. BAT-A1B2C3)
    refresh_hash     TEXT         NOT NULL,               -- SHA-256 of the refresh token (stored, never returned)
    expires_at       TIMESTAMPTZ  NOT NULL,               -- sliding 30-day window
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallboard_tokens_code ON wallboard_tokens (code);
