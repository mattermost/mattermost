DROP INDEX IF EXISTS idx_recap_channels_channel_id;
DROP INDEX IF EXISTS idx_recap_channels_recap_id;
DROP TABLE IF EXISTS RecapChannels;

DROP INDEX IF EXISTS idx_recaps_bot_id;
DROP INDEX IF EXISTS idx_recaps_user_id_read_at;
DROP INDEX IF EXISTS idx_recaps_user_id_delete_at;
DROP INDEX IF EXISTS idx_recaps_create_at;
DROP INDEX IF EXISTS idx_recaps_user_id;
DROP TABLE IF EXISTS Recaps;


