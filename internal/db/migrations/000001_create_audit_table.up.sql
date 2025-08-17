CREATE TABLE audit (
    id            VARCHAR(64) PRIMARY KEY,
    method        VARCHAR(8) NOT NULL,
    path          VARCHAR(255) NOT NULL,
    status_code   INTEGER,
    response_time BIGINT,

    identifier    VARCHAR(128),
    user_email    VARCHAR(128),
    user_name     VARCHAR(128),
    user_roles    JSONB,
    user_type     VARCHAR(64),
    tenant_id     VARCHAR(64),

    ip            VARCHAR(64),
    user_agent    VARCHAR(255),
    request_id    VARCHAR(128),
    query_params  JSONB,
    request_body  JSONB,
    error_message TEXT,

    service_name  VARCHAR(128),
    environment   VARCHAR(64),
    timestamp     TIMESTAMP NOT NULL
);