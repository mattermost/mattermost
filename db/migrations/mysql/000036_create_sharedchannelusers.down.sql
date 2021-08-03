SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'ALTER TABLE SharedChannelUsers DROP COLUMN ChannelId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS SharedChannelUsers;
