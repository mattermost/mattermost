SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND index_name = 'posts_unique'
    ),
    'ALTER TABLE IR_StatusPosts ADD CONSTRAINT posts_unique UNIQUE (IncidentID, PostID)',
    'SELECT 1'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
