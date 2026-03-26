-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recap_channels_channel_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recap_channels_recap_id;
DROP TABLE IF EXISTS RecapChannels;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recaps_bot_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recaps_user_id_read_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recaps_user_id_delete_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recaps_create_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_recaps_user_id;
DROP TABLE IF EXISTS Recaps;


