DROP INDEX IF EXISTS idx_threads_channel_id ON threads;

ALTER TABLE threads DROP COLUMN IF EXISTS channelid;

DROP TABLE IF EXISTS threads;
