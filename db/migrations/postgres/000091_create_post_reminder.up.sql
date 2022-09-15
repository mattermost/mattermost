CREATE TABLE IF NOT EXISTS postreminders (
    postid varchar(26) NOT NULL,
    userid varchar(26) NOT NULL,
    targettime bigint,
    PRIMARY KEY (postid, userid)
);

CREATE INDEX IF NOT EXISTS idx_postreminders_targettime ON postreminders(targettime);