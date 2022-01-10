CREATE TABLE IF NOT EXISTS commands (
    id VARCHAR(26) PRIMARY KEY,
    token VARCHAR(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid VARCHAR(26),
    teamid VARCHAR(26),
    trigger VARCHAR(128),
    method VARCHAR(1),
    username VARCHAR(64),
    iconurl VARCHAR(1024),
    autocomplete bool,
    autocompletedesc VARCHAR(1024),
    autocompletehint VARCHAR(1024),
    displayname VARCHAR(64),
    description VARCHAR(128),
    url VARCHAR(1024)
);

CREATE INDEX IF NOT EXISTS idx_command_team_id ON commands (teamid);
CREATE INDEX IF NOT EXISTS idx_command_update_at ON commands (updateat);
CREATE INDEX IF NOT EXISTS idx_command_create_at ON commands (createat);
CREATE INDEX IF NOT EXISTS idx_command_delete_at ON commands (deleteat);

ALTER TABLE commands ADD COLUMN IF NOT EXISTS pluginid VARCHAR(190);

UPDATE commands SET pluginid = '' WHERE pluginid IS NULL;
