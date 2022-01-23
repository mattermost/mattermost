CREATE TABLE IF NOT EXISTS OAuthApps (
  Id varchar(26) NOT NULL,
  CreatorId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  UpdateAt bigint(20) DEFAULT NULL,
  ClientSecret varchar(128) DEFAULT NULL,
  Name varchar(64) DEFAULT NULL,
  Description text,
  CallbackUrls text,
  Homepage text,
  PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND index_name = 'idx_oauthapps_creator_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_oauthapps_creator_id ON OAuthApps(CreatorId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'IsTrusted'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OAuthApps ADD IsTrusted tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'IconURL'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OAuthApps ADD IconURL text;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
