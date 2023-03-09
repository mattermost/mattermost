CREATE TABLE IF NOT EXISTS GroupMembers (
    GroupId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (GroupId, UserId),
    KEY idx_groupmembers_create_at (CreateAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupmembers_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupmembers_create_at ON GroupMembers(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
