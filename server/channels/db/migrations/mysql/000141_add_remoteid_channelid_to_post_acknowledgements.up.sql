SET @preparedStatement1 = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PostAcknowledgements'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'SELECT 1;',
    'ALTER TABLE PostAcknowledgements ADD COLUMN RemoteId varchar(26) DEFAULT \'\';'
));

PREPARE addColumnIfNotExists FROM @preparedStatement1;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

SET @preparedStatement2 = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PostAcknowledgements'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'SELECT 1;',
    'ALTER TABLE PostAcknowledgements ADD COLUMN ChannelId varchar(26) DEFAULT \'\';'
));

PREPARE addColumnIfNotExists FROM @preparedStatement2;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;