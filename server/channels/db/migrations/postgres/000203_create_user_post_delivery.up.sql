CREATE TABLE IF NOT EXISTS UserPostDelivery (
    post_id     VARCHAR(26) NOT NULL,
    target_id   VARCHAR(190) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    mechanism   SMALLINT    NOT NULL DEFAULT 0,
    created_at  BIGINT      NOT NULL,
    UNIQUE (post_id, target_id, target_type, mechanism)
);
