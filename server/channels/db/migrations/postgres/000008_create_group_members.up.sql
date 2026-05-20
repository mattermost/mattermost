CREATE TABLE IF NOT EXISTS groupmembers (
    groupid VARCHAR(26),
    userid VARCHAR(26),
    createat bigint,
    deleteat bigint,
    PRIMARY KEY(groupid, userid)
);

CREATE INDEX IF NOT EXISTS idx_groupmembers_create_at ON groupmembers (createat);
