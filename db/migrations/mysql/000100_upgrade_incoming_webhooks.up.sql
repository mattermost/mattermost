SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Enabled'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE IncomingWebhooks ADD Enabled tinyint(1) NOT NULL DEFAULT TRUE;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;