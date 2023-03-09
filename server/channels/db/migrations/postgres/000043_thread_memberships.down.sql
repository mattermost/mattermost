DROP INDEX IF EXISTS idx_thread_memberships_user_id;
DROP INDEX IF EXISTS idx_thread_memberships_last_view_at;
DROP INDEX IF EXISTS idx_thread_memberships_last_update_at;

ALTER TABLE threadmemberships DROP COLUMN IF EXISTS unreadmentions;

DROP TABLE IF EXISTS theadmemberships;
