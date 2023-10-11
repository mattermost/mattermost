SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_team_id ON Channels(TeamId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id_type'
    ) > 0,
    'DROP INDEX idx_channels_team_id_type ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id_display_name'
    ) > 0,
    'DROP INDEX idx_channels_team_id_display_name ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
