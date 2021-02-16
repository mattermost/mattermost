CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(26) PRIMARY KEY,
    displayname VARCHAR(64),
    name VARCHAR(64),
    description VARCHAR(255),
    email VARCHAR(128),
    type VARCHAR(255),
    companyname VARCHAR(64),
    alloweddomains VARCHAR(1000),
    inviteid VARCHAR(32),
    schemeid VARCHAR(26),
    allowopeninvite boolean,
    lastteamiconupdate bigint,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON teams (name) ;
CREATE INDEX IF NOT EXISTS idx_teams_invite_id ON teams (inviteid);
CREATE INDEX IF NOT EXISTS idx_teams_update_at ON teams (updateat);
CREATE INDEX IF NOT EXISTS idx_teams_create_at ON teams (createat);
CREATE INDEX IF NOT EXISTS idx_teams_delete_at ON teams (deleteat);
CREATE INDEX IF NOT EXISTS idx_teams_scheme_id ON teams (schemeid);
