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
  PRIMARY KEY (Id),
  KEY idx_oauthapps_creator_id (CreatorId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'IsTrusted'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OAuthApps ADD IsTrusted tinyint(1) DEFAULT 0;'
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
    'ALTER TABLE OAuthApps ADD IconURL varchar(512) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
