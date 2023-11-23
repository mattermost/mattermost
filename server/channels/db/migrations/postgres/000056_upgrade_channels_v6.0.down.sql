CREATE INDEX IF NOT EXISTS idx_channels_team_id ON channels(teamid);

DROP INDEX IF EXISTS idx_channels_team_id_type;
DROP INDEX IF EXISTS idx_channels_team_id_display_name;
