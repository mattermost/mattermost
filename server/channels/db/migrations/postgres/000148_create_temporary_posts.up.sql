CREATE TABLE IF NOT EXISTS TemporaryPosts (
    PostId VARCHAR(26) PRIMARY KEY,
    Type VARCHAR(26) NOT NULL,
    ExpireAt BIGINT NOT NULL,
    Message VARCHAR(65535),
    FileIds VARCHAR(300)
);

CREATE INDEX IF NOT EXISTS idx_temporary_posts_expire_at ON TemporaryPosts(expireat);
