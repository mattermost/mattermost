SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'VoipDeviceId'
    ) > 0,
    'ALTER TABLE Sessions DROP COLUMN VoipDeviceId;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
