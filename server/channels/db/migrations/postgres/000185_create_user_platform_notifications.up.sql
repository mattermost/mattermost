CREATE TABLE IF NOT EXISTS userplatformnotifications (
    id VARCHAR(64) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    postid VARCHAR(26) NOT NULL,
    channelid VARCHAR(26) NOT NULL,
    teamid VARCHAR(26) NOT NULL,
    recordedat bigint NOT NULL,
    readat bigint,
    channeldisplayname VARCHAR(128) NOT NULL DEFAULT '',
    contextlabel VARCHAR(256) NOT NULL DEFAULT '',
    permalinkurl VARCHAR(512) NOT NULL DEFAULT '',
    isthreadreply boolean NOT NULL DEFAULT false,
    ismention boolean NOT NULL DEFAULT false,
    isdirectmessage boolean NOT NULL DEFAULT false,
    senderuserid VARCHAR(26),
    threadrootid VARCHAR(26),
    replycount integer,
    participantuserids VARCHAR(8000),
    previewbody TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (userid, id)
);

CREATE INDEX IF NOT EXISTS idx_userplatformnotifications_userid_recordedat ON userplatformnotifications (userid, recordedat DESC);
