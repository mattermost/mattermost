CREATE TABLE IF NOT EXISTS ReadReceipts (
    PostId VARCHAR(26) NOT NULL,
    UserId VARCHAR(26) NOT NULL,
    ExpireAt bigint NOT NULL,
    PRIMARY KEY (PostId, UserId)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_post_id ON ReadReceipts(PostId);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_id_post_id_expire_at ON ReadReceipts(UserId, PostId, ExpireAt);

CREATE TABLE IF NOT EXISTS TemporaryPosts (
    PostId VARCHAR(26) PRIMARY KEY,
    Type VARCHAR(26) NOT NULL,
    ExpireAt BIGINT NOT NULL,
    Message VARCHAR(65535),
    FileIds VARCHAR(300)
);

CREATE INDEX IF NOT EXISTS idx_temporary_posts_expire_at ON TemporaryPosts(expireat);

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS Type text;
ALTER TABLE scheduledposts ADD COLUMN IF NOT EXISTS Type text;
