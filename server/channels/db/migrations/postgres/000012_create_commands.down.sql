-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_commands_team_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_commands_update_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_commands_create_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_commands_delete_at;

ALTER TABLE commands DROP COLUMN IF EXISTS pluginid;

DROP TABLE IF EXISTS commands;
