CREATE TABLE IF NOT EXISTS teammembers (
    teamid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    roles VARCHAR(64),
    deleteat bigint,
    PRIMARY KEY (teamid, userid)
);

CREATE INDEX IF NOT EXISTS idx_teammembers_team_id ON TeamMembers (teamid);
CREATE INDEX IF NOT EXISTS idx_teammembers_user_id ON TeamMembers (userid);
CREATE INDEX IF NOT EXISTS idx_teammembers_delete_at ON TeamMembers (deleteat);
