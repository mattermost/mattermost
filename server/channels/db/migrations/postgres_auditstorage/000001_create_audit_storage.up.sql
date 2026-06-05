CREATE UNLOGGED TABLE IF NOT EXISTS audit_storage (
    user_id    VARCHAR(26) NOT NULL,
    entity_id    VARCHAR(26) NOT NULL,
    created_at BIGINT      NOT NULL,
    mechanism SMALLINT NOT NULL DEFAULT 0
);
