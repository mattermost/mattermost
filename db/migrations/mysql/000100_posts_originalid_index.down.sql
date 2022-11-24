SET @preparedStatement = (SELECT IF(
     (
         SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
         WHERE table_name = 'Posts'
         AND table_schema = DATABASE()
         AND index_name = 'idx_posts_original_id'
     ) > 0,
     'DROP INDEX idx_posts_original_id on Posts;',
     'SELECT 1;'
 ));

 PREPARE removeIndexIfExists FROM @preparedStatement;
 EXECUTE removeIndexIfExists;
 DEALLOCATE PREPARE removeIndexIfExists;