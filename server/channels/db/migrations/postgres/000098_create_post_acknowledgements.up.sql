CREATE TABLE IF NOT EXISTS postacknowledgements(
    postid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    acknowledgedat bigint,
    PRIMARY KEY (postid, userid)
);
