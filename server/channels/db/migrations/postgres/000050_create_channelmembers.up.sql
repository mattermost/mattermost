CREATE TABLE IF NOT EXISTS channelmembers (
    channelid varchar(26) NOT NULL,
    userid varchar(26) NOT NULL,
    roles varchar(64),
    lastviewedat bigint,
    msgcount bigint,
    mentioncount bigint,
    notifyprops varchar(2000),
    lastupdateat bigint,
    PRIMARY KEY (channelid, userid)
);

CREATE INDEX IF NOT EXISTS idx_channelmembers_user_id ON channelmembers(userid);

ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS schemeuser boolean;
ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS schemeadmin boolean;

ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS schemeguest boolean;

DROP INDEX IF EXISTS idx_channelmembers_channel_id;
