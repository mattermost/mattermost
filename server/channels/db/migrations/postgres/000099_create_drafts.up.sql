CREATE TABLE IF NOT EXISTS drafts (
    createat bigint,
    updateat bigint,
    deleteat bigint,
    userid VARCHAR(26),
    channelid VARCHAR(26),
    rootid VARCHAR(26) DEFAULT '',
    message VARCHAR(65535),
    props VARCHAR(8000),
    fileids VARCHAR(300),
    PRIMARY KEY (userid, channelid, rootid)
);
