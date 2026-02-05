DROP INDEX IF EXISTS idx_translations_channel_updateat;
ALTER TABLE translations DROP COLUMN IF EXISTS channelid;
