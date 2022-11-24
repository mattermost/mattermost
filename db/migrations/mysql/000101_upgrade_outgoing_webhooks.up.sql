SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Enabled'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD Enabled tinyint(1) DEFAULT 1;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;