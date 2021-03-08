DROP INDEX IF EXISTS idx_commands_team_id;
DROP INDEX IF EXISTS idx_commands_update_at;
DROP INDEX IF EXISTS idx_commands_create_at;
DROP INDEX IF EXISTS idx_commands_delete_at;

ALTER TABLE commands DROP COLUMN IF EXISTS pluginid;

DROP TABLE IF EXISTS commands;
