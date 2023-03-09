CREATE INDEX IF NOT EXISTS idx_publicchannels_name ON publicchannels (name);

DROP INDEX IF EXISTS idx_publicchannels_team_id;
DROP INDEX IF EXISTS idx_publicchannels_name;
DROP INDEX IF EXISTS idx_publicchannels_delete_at;
DROP INDEX IF EXISTS idx_publicchannels_name_lower;
DROP INDEX IF EXISTS idx_publicchannels_displayname_lower;
DROP INDEX IF EXISTS idx_publicchannels_search_txt;

DROP TABLE IF EXISTS publicchannels;
