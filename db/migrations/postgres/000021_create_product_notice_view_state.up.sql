CREATE TABLE IF NOT EXISTS productnoticeviewstate (
    userid VARCHAR(26),
    noticeid VARCHAR(26),
    viewed integer,
    "timestamp" bigint,
    PRIMARY KEY (userid, noticeid)
);

CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON productnoticeviewstate(noticeid);
CREATE INDEX IF NOT EXISTS idx_notice_views_timestamp ON productnoticeviewstate("timestamp");

DROP INDEX IF EXISTS idx_notice_views_user_id;
DROP INDEX IF EXISTS idx_notice_views_user_notice;
