CREATE TABLE IF NOT EXISTS ChannelMemberHistory (
  ChannelId varchar(26) NOT NULL,
  UserId varchar(26) NOT NULL,
  JoinTime bigint(20) NOT NULL,
  LeaveTime bigint(20) DEFAULT NULL,
  PRIMARY KEY (ChannelId, UserId, JoinTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMemberHistory'
        AND table_schema = DATABASE()
        AND column_name = 'Email'
    ) > 0,
    'ALTER TABLE ChannelMemberHistory DROP COLUMN Email',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMemberHistory'
        AND table_schema = DATABASE()
        AND column_name = 'Username'
    ) > 0,
    'ALTER TABLE ChannelMemberHistory DROP COLUMN Username',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
