SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'Scopes'
    ) > 0,
    'ALTER TABLE OAuthApps DROP COLUMN Scopes;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
