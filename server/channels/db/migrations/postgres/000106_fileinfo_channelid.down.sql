DROP INDEX IF EXISTS idx_fileinfo_channel_id_create_at;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS channelid;
