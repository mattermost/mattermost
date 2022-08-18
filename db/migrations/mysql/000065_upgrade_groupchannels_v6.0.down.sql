
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupchannels_schemeadmin'
    ) > 0,
    'DROP INDEX idx_groupchannels_schemeadmin ON GroupChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
