-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_channels_team_id ON channels(teamid);

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_channels_team_id_type;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_channels_team_id_display_name;
