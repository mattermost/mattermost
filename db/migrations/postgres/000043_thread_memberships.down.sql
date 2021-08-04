DROP INDEX IF EXISTS idx_thread_memberships_user_id ON theadmemberships;
DROP INDEX IF EXISTS idx_thread_memberships_last_view_at ON theadmemberships;
DROP INDEX IF EXISTS idx_thread_memberships_last_update_at ON theadmemberships;

ALTER TABLE threadmemberships DROP COLUMN IF EXISTS unreadmentions;

DROP TABLE IF EXISTS theadmemberships;
