CREATE TABLE notification_channels (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type       VARCHAR(16) NOT NULL CHECK (type IN ('push', 'webhook')),
    config     JSONB       NOT NULL DEFAULT '{}',
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_deliveries (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id     UUID        NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    alert_event_id TEXT,
    status         VARCHAR(16) NOT NULL, -- success | failed
    status_code    INT,
    response_body  TEXT,
    delivered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_channels_project  ON notification_channels(project_id);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel_id);
