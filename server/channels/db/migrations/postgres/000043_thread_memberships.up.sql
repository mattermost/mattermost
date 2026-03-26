CREATE TABLE IF NOT EXISTS threadmemberships(
    postid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    following boolean,
    lastviewed bigint,
    lastupdated bigint,
    PRIMARY KEY (postid, userid)
);

ALTER TABLE threadmemberships ADD COLUMN IF NOT EXISTS unreadmentions bigint;

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_thread_memberships_last_update_at ON threadmemberships(lastupdated);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_thread_memberships_last_view_at ON threadmemberships(lastviewed);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_thread_memberships_user_id ON threadmemberships(userid);
