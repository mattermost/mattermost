CREATE TABLE IF NOT EXISTS OAuthAuthData (
  ClientId varchar(26) DEFAULT NULL,
  UserId varchar(26) DEFAULT NULL,
  Code varchar(128) NOT NULL,
  ExpiresIn int(11) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  RedirectUri text,
  State text,
  Scope varchar(128) DEFAULT NULL,
  PRIMARY KEY (Code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthAuthData'
        AND table_schema = DATABASE()
        AND column_name = 'State'
        AND (data_type != 'varchar' OR character_maximum_length != 1024)
    ) > 0,
    'ALTER TABLE OAuthAuthData MODIFY State text;',
    'SELECT 1'
));

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OAuthAuthData'
        AND table_schema = DATABASE()
        AND index_name = 'idx_oauthauthdata_client_id'
    ) > 0,
    'DROP INDEX idx_oauthauthdata_client_id ON OAuthAuthData;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
