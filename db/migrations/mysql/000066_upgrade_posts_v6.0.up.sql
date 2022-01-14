CREATE PROCEDURE MigrateRootId_Posts () BEGIN DECLARE ParentId_EXIST INT;
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Posts'
  AND table_schema = DATABASE()
  AND COLUMN_NAME = 'ParentId' INTO ParentId_EXIST;
IF(ParentId_EXIST > 0) THEN
    UPDATE Posts SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
    ALTER TABLE Posts MODIFY COLUMN FileIds text, MODIFY COLUMN Props JSON, DROP COLUMN ParentId;
ELSE
    ALTER TABLE Posts MODIFY COLUMN FileIds text, MODIFY COLUMN Props JSON;
END IF;
END;

CALL MigrateRootId_Posts ();
DROP PROCEDURE IF EXISTS MigrateRootId_Posts;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_posts_root_id_delete_at ON Posts(RootId, DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id'
    ) > 0,
    'DROP INDEX idx_posts_root_id ON Posts;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
