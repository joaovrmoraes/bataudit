CREATE TABLE users (
    id            VARCHAR(64) PRIMARY KEY,
    name          VARCHAR(128) NOT NULL,
    email         VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32) NOT NULL DEFAULT 'viewer',
    created_at    DATETIME NOT NULL
);

CREATE TABLE projects (
    id         VARCHAR(64) PRIMARY KEY,
    name       VARCHAR(128) NOT NULL,
    slug       VARCHAR(128) NOT NULL UNIQUE,
    created_by VARCHAR(64) REFERENCES users(id),
    created_at DATETIME NOT NULL
);

CREATE TABLE project_members (
    user_id    VARCHAR(64) NOT NULL REFERENCES users(id),
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id),
    role       VARCHAR(32) NOT NULL DEFAULT 'viewer',
    PRIMARY KEY (user_id, project_id)
);

CREATE TABLE api_keys (
    id         VARCHAR(64) PRIMARY KEY,
    key_hash   VARCHAR(255) NOT NULL,
    project_id VARCHAR(64) REFERENCES projects(id),
    name       VARCHAR(128) NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME,
    active     BOOLEAN NOT NULL DEFAULT TRUE
);
