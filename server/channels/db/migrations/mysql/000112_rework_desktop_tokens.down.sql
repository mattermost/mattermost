SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'DesktopTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_desktoptokens_token_createat'
    ) > 0,
    'DROP INDEX idx_desktoptokens_token_createat ON DesktopTokens;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS DesktopTokens;

CREATE TABLE IF NOT EXISTS DesktopTokens (
    DesktopToken varchar(64) NOT NULL,
    ServerToken varchar(64) NULL,
    UserId varchar(26) NULL,
    CreateAt bigint NOT NULL,
    PRIMARY KEY (DesktopToken)
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'DesktopTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_desktoptokens_createat'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_desktoptokens_createat ON DesktopTokens(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;