CREATE TABLE IF NOT EXISTS audit_storage (
    user_id    VARCHAR(26) NOT NULL,
    post_id    VARCHAR(26) NOT NULL,
    mechanism  SMALLINT    NOT NULL DEFAULT 0,
    created_at BIGINT      NOT NULL
);
