CREATE TABLE IF NOT EXISTS audit_storage (
    user_id    VARCHAR(26) NOT NULL,
    entity_id    VARCHAR(26) NOT NULL,
    mechanism  SMALLINT    NOT NULL DEFAULT 0,
    created_at BIGINT      NOT NULL,
    UNIQUE(entity_id, user_id, mechanism)
);
