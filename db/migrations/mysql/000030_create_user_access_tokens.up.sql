CREATE TABLE IF NOT EXISTS UserAccessTokens (
    Id varchar(26) NOT NULL,
    Token varchar(26) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    Description text,
    PRIMARY KEY (Id),
    UNIQUE (Token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND column_name = 'IsActive'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE UserAccessTokens ADD COLUMN IsActive tinyint(1) DEFAULT NULL;'
));

PREPARE alterNotIfExists FROM @preparedStatement;
EXECUTE alterNotIfExists;
DEALLOCATE PREPARE alterNotIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_user_access_tokens_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_user_access_tokens_user_id ON UserAccessTokens(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_user_access_tokens_token'
    ) > 0,
    'DROP INDEX idx_user_access_tokens_token ON UserAccessTokens;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
