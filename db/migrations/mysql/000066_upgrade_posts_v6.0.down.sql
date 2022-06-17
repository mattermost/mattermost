SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_posts_root_id ON Posts(RootId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id_delete_at'
    ) > 0,
    'DROP INDEX idx_posts_root_id_delete_at ON Posts;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'Props'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Posts MODIFY COLUMN Props text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'FileIds'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Posts MODIFY COLUMN FileIds text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Posts ADD COLUMN ParentId varchar(26) DEFAULT NULL;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
