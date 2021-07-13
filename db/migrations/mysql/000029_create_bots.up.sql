CREATE TABLE IF NOT EXISTS Bots (
    UserId varchar(26) NOT NULL,
    Description text,
    OwnerId varchar(190) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Bots'
        AND table_schema = DATABASE()
        AND column_name = 'LastIconUpdate'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Bots ADD LastIconUpdate bigint;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
