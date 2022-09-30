SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND column_name = 'CreateAt'
    ),
    'ALTER TABLE PublicChannels ADD COLUMN CreateAt bigint(20);',
    'SELECT 1;'
));
PREPARE addColumnIfNotExists FROM @preparedStatement; EXECUTE addColumnIfNotExists; DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE PublicChannels SET CreateAt = (SELECT CreateAt FROM Channels WHERE Channels.Id = PublicChannels.Id);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_create_at ON PublicChannels(CreateAt);'
));
PREPARE createIndexIfNotExists FROM @preparedStatement; EXECUTE createIndexIfNotExists; DEALLOCATE PREPARE createIndexIfNotExists;
