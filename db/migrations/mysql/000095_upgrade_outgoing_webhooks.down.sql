SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Enabled'
    ) > 0,
    'ALTER TABLE Reactions DROP COLUMN Enabled;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
