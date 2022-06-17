
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_name ON PublicChannels(name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_search_txt'
    ) > 0,
    'DROP INDEX idx_publicchannels_search_txt ON PublicChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_delete_at'
    ) > 0,
    'DROP INDEX idx_publicchannels_delete_at ON PublicChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_name'
    ) > 0,
    'DROP INDEX idx_publicchannels_name ON PublicChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_team_id'
    ) > 0,
    'DROP INDEX idx_publicchannels_team_id ON PublicChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS PublicChannels;
