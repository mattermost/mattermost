CREATE INDEX IF NOT EXISTS idx_notice_views_user_notice ON productnoticeviewstate (userid, noticeid);
CREATE INDEX IF NOT EXISTS idx_notice_views_user_id ON productnoticeviewstate (userid);

DROP TABLE IF EXISTS productnoticeviewstate;
