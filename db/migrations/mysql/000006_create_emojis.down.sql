SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Emoji'
        AND table_schema = DATABASE()
        AND index_name = 'idx_emoji_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_emoji_name ON Emoji(Name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS Emoji;
