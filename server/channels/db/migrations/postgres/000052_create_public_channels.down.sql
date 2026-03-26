-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_publicchannels_name ON publicchannels (name);

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_team_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_name;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_delete_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_name_lower;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_displayname_lower;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_publicchannels_search_txt;

DROP TABLE IF EXISTS publicchannels;
