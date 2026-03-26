CREATE TABLE IF NOT EXISTS productnoticeviewstate (
    userid VARCHAR(26),
    noticeid VARCHAR(26),
    viewed integer,
    "timestamp" bigint,
    PRIMARY KEY (userid, noticeid)
);

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON productnoticeviewstate(noticeid);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_notice_views_timestamp ON productnoticeviewstate("timestamp");

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_notice_views_user_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_notice_views_user_notice;
