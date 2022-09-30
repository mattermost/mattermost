SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND column_name = 'CreateAt'
    ) > 0,
    'ALTER TABLE PublicChannels DROP COLUMN CreateAt;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement; EXECUTE removeColumnIfExists; DEALLOCATE PREPARE removeColumnIfExists;
