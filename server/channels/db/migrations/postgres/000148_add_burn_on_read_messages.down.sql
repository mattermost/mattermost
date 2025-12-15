DROP INDEX IF EXISTS idx_read_receipts_post_id;
DROP INDEX IF EXISTS idx_read_receipts_user_id_post_id_expire_at;
DROP TABLE IF EXISTS ReadReceipts;

DROP INDEX IF EXISTS idx_temporary_posts_expire_at;
DROP TABLE IF EXISTS TemporaryPosts;

ALTER TABLE drafts DROP COLUMN IF EXISTS type;
ALTER TABLE scheduledposts DROP COLUMN IF EXISTS type;
