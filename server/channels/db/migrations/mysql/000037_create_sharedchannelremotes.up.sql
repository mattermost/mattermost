CREATE TABLE IF NOT EXISTS SharedChannelRemotes (
  Id varchar(26) NOT NULL,
  ChannelId varchar(26) NOT NULL,
  CreatorId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  UpdateAt bigint(20) DEFAULT NULL,
  IsInviteAccepted tinyint(1) DEFAULT NULL,
  IsInviteConfirmed tinyint(1) DEFAULT NULL,
  RemoteId varchar(26) DEFAULT NULL,
  PRIMARY KEY (Id, ChannelId),
  UNIQUE KEY ChannelId (ChannelId, RemoteId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostUpdateAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelRemotes ADD LastPostUpdateAt bigint;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelRemotes ADD LastPostId VARCHAR(26);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;