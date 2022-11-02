CREATE TABLE IF NOT EXISTS postacknowledgements(
    postid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    acknowledgedat bigint,
    createat bigint,
    deleteat bigint,
    PRIMARY KEY (postid, userid)
);
