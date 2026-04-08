CREATE TABLE notification_channels (
    id         TEXT        PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type       VARCHAR(16) NOT NULL CHECK (type IN ('push', 'webhook')),
    config     TEXT        NOT NULL DEFAULT '{}',
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_deliveries (
    id             TEXT     PRIMARY KEY,
    channel_id     TEXT     NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    alert_event_id TEXT,
    status         VARCHAR(16) NOT NULL,
    status_code    INT,
    response_body  TEXT,
    delivered_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_channels_project  ON notification_channels(project_id);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel_id);
