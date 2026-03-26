-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_channels_team_id_display_name ON channels(teamid, displayname);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_channels_team_id_type ON channels(teamid, type);

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_channels_team_id;
