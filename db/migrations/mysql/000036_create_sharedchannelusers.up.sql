CREATE TABLE IF NOT EXISTS SharedChannelUsers (
  Id varchar(26) NOT NULL,
  UserId varchar(26) DEFAULT NULL,
  RemoteId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  LastSyncAt bigint(20) DEFAULT NULL,
  PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelUsers ADD ChannelId varchar(26) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND constraint_type = 'UNIQUE'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelUsers ADD CONSTRAINT UNIQUE KEY UserId(UserId, ChannelId, RemoteId)'
));

PREPARE alterIfUniqueNotExists FROM @preparedStatement;
EXECUTE alterIfUniqueNotExists;
DEALLOCATE PREPARE alterIfUniqueNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sharedchannelusers_user_id'
    ) > 0,
    'DROP INDEX idx_sharedchannelusers_user_id ON SharedChannelUsers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
