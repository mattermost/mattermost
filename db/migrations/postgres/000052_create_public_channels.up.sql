CREATE TABLE IF NOT EXISTS publicchannels (
	id VARCHAR(26) PRIMARY KEY,
	deleteat bigint,
	teamid VARCHAR(26),
	displayname VARCHAR(64),
	name VARCHAR(64),
	header VARCHAR(1024),
	purpose VARCHAR(250),
	UNIQUE (name, teamid)
);

CREATE INDEX IF NOT EXISTS idx_publicchannels_team_id ON publicchannels (teamid);
CREATE INDEX IF NOT EXISTS idx_publicchannels_name ON publicchannels (name);
CREATE INDEX IF NOT EXISTS idx_publicchannels_delete_at ON publicchannels (deleteat);
CREATE INDEX IF NOT EXISTS idx_publicchannels_name_lower ON publicchannels (lower(name));
CREATE INDEX IF NOT EXISTS idx_publicchannels_displayname_lower ON publicchannels (lower(displayname));
CREATE INDEX IF NOT EXISTS idx_publicchannels_search_txt ON publicchannels using gin (to_tsvector('english'::regconfig, (((((name)::text || ' '::text) || (displayname)::text) || ' '::text) || (purpose)::text)));

DO $$
	<< migratepc >>
BEGIN
	IF(NOT EXISTS (
		SELECT
			1 FROM publicchannels)) THEN
		INSERT INTO publicchannels (id, deleteat, teamid, displayname, name, header, purpose)
		SELECT
			c.id, c.deleteat, c.teamid, c.displayname, c.name, c.header, c.purpose
		FROM
			channels c
		LEFT JOIN publicchannels pc ON (pc.id = c.id)
	WHERE
		c.type = 'O' AND pc.id IS NULL;
	END IF;
END migratepc
$$;

DROP INDEX IF EXISTS idx_publicchannels_name;
