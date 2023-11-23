SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ),
    'ALTER TABLE FileInfo ADD COLUMN ChannelId varchar(26);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE FileInfo, Posts
SET FileInfo.ChannelId = Posts.ChannelId
WHERE FileInfo.PostId = Posts.Id
AND FileInfo.ChannelId IS NULL;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND index_name = 'idx_fileinfo_channel_id_create_at'
    ),
    'CREATE INDEX idx_fileinfo_channel_id_create_at ON FileInfo(ChannelId, CreateAt);',
    'SELECT 1'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
