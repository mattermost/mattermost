CREATE TABLE IF NOT EXISTS PostsPriority (
    PostId varchar(26) NOT NULL,
    ChannelId varchar(26) NOT NULL,
    Priority varchar(32) NOT NULL,
    RequestedAck tinyint(1),
    PersistentNotifications tinyint(1),
    PRIMARY KEY (PostId),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'UrgentMentionCount'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ChannelMembers ADD COLUMN UrgentMentionCount bigint(20) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
