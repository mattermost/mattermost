ALTER TABLE threads ALTER COLUMN participants TYPE jsonb USING participants::jsonb;
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_threads_channel_id_last_reply_at ON threads(channelid, lastreplyat);
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_threads_channel_id;
