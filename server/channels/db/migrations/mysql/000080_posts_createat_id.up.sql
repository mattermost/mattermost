SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_create_at_id'
    ) > 0,
    'SELECT 1;',
    'CREATE INDEX idx_posts_create_at_id on Posts(CreateAt, Id) LOCK=NONE;'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
