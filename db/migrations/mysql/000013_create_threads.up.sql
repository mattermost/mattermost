CREATE TABLE IF NOT EXISTS Threads (
    PostId varchar(26) NOT NULL,
    ReplyCount bigint(20),
    LastReplyAt bigint(20),
    Participants text,
    PRIMARY KEY (PostId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Reactions ADD COLUMN DeleteAt bigint(20);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND index_name = 'idx_threads_channel_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_threads_channel_id ON Threads(ChannelId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

UPDATE Threads
INNER JOIN Posts ON Posts.Id=Threads.PostId
SET Threads.ChannelId=Posts.ChannelId
WHERE Threads.ChannelId IS NULL;
