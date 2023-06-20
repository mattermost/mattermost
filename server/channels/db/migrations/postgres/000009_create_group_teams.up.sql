CREATE TABLE IF NOT EXISTS groupteams (
    groupid VARCHAR(26),
    autoadd boolean,
    schemeadmin boolean,
    createat bigint,
    deleteat bigint,
    updateat bigint,
    teamid VARCHAR(26),
    PRIMARY KEY(groupid, teamid)
);

ALTER TABLE groupteams ADD COLUMN IF NOT EXISTS schemeadmin boolean default false;

CREATE INDEX IF NOT EXISTS idx_groupteams_schemeadmin ON groupteams (schemeadmin);
CREATE INDEX IF NOT EXISTS idx_groupteams_teamid ON groupteams (teamid);
