CREATE TABLE IF NOT EXISTS channelmemberhistory (
    channelid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    jointime bigint NOT NULL,
    leavetime bigint,
    PRIMARY KEY (channelid, userid, jointime)
);

ALTER TABLE channelmemberhistory DROP COLUMN IF EXISTS email;
ALTER TABLE channelmemberhistory DROP COLUMN IF EXISTS username;
