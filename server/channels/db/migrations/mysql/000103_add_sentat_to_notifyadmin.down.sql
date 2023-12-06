SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'NotifyAdmin'
        AND table_schema = DATABASE()
        AND column_name = 'SentAt'
    ) > 0,
    'ALTER TABLE NotifyAdmin DROP COLUMN SentAt;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
