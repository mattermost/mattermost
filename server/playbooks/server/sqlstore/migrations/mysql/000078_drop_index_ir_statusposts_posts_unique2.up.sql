SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND index_name = 'posts_unique'
    ) ,
    'DROP INDEX posts_unique ON IR_StatusPosts',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
