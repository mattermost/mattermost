CREATE TABLE IF NOT EXISTS reactions(
    userid VARCHAR(26) NOT NULL,
    postid VARCHAR(26) NOT NULL,
    emojiname VARCHAR(64) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    PRIMARY KEY (postid, userid, emojiname)
);
