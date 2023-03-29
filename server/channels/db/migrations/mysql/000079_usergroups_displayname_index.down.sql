SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_displayname'
    ) > 0,
    'DROP INDEX idx_usergroups_displayname ON UserGroups;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;