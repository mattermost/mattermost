CREATE UNLOGGED TABLE IF NOT EXISTS user_post_reads (
    user_id    VARCHAR(26) NOT NULL,
    post_id    VARCHAR(26) NOT NULL,
    created_at BIGINT      NOT NULL
);
