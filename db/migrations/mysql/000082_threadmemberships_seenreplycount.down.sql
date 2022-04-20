SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND column_name = 'SeenReplyCount'
    ) > 0,
    'ALTER TABLE Threads DROP COLUMN SeenReplyCount;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
