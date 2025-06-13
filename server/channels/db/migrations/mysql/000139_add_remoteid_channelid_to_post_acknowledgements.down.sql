SET @preparedStatement1 = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PostAcknowledgements'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'ALTER TABLE PostAcknowledgements DROP COLUMN RemoteId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement1;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement2 = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PostAcknowledgements'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'ALTER TABLE PostAcknowledgements DROP COLUMN ChannelId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement2;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;