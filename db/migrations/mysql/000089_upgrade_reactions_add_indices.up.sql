SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_reactions_post_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_reactions_post_id ON Reactions(PostId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_reactions_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_reactions_user_id ON Reactions(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
