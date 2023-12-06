SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_user_id'
    ) > 0,
    'DROP INDEX idx_thread_memberships_user_id ON ThreadMemberships;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_last_view_at'
    ) > 0,
    'DROP INDEX idx_thread_memberships_last_view_at ON ThreadMemberships;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_last_update_at'
    ) > 0,
    'DROP INDEX idx_thread_memberships_last_update_at ON ThreadMemberships;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND column_name = 'UnreadMentions'
    ) > 0,
    'ALTER TABLE ThreadMemberships DROP COLUMN UnreadMentions;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS ThreadMemberships;
