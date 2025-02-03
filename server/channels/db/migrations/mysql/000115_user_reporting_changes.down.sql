SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'LastLogin'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN LastLogin;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
