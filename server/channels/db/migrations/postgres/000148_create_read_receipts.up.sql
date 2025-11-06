CREATE TABLE IF NOT EXISTS ReadReceipts (
    PostId VARCHAR(26) NOT NULL,
    UserId VARCHAR(26) NOT NULL,
    ExpireAt bigint NOT NULL,
    PRIMARY KEY (PostId, UserId)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_post_id ON ReadReceipts(postId);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_id_post_id_expire_at ON ReadReceipts(userId, postId, expireAt);
