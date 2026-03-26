-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON threads(channelid);
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_threads_channel_id_last_reply_at;
ALTER TABLE threads ALTER COLUMN participants TYPE text;
