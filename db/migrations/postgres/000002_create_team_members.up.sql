CREATE TABLE IF NOT EXISTS teammembers (
    teamid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    roles VARCHAR(64),
    deleteat bigint,
    PRIMARY KEY (teamid, userid)
);

CREATE INDEX IF NOT EXISTS idx_teammembers_user_id ON TeamMembers (userid);
CREATE INDEX IF NOT EXISTS idx_teammembers_delete_at ON TeamMembers (deleteat);

ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS schemeuser boolean;
ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS schemeadmin boolean;
ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS schemeguest boolean;
ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS deleteat bigint;

DROP INDEX IF EXISTS idx_teammembers_team_id;
