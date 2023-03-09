CREATE TABLE IF NOT EXISTS Audits (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    Action text,
    ExtraInfo text,
    IpAddress varchar(64) DEFAULT NULL,
    SessionId varchar(26) DEFAULT NULL,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Audits'
        AND table_schema = DATABASE()
        AND index_name = 'idx_audits_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_audits_user_id ON Audits(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
