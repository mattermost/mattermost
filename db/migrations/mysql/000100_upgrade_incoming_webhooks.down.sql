SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Enabled'
    ) > 0,
    'ALTER TABLE IncomingWebhooks DROP COLUMN Enabled;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
