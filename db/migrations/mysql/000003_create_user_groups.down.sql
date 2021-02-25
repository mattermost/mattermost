SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_remote_id'
    ) > 0,
    'DROP INDEX idx_usergroups_remote_id;',
    'SELECT 1'
));

PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

SET @preparedStatement = (SELECT IF(
(
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_delete_at'
    ) > 0,
    'DROP INDEX idx_usergroups_delete_at;',
    'SELECT 1'
));

PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

DROP TABLE IF EXISTS UserGroups;
