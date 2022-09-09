CREATE TABLE IF NOT EXISTS Status (
    UserId varchar(26) NOT NULL,
    Status varchar(32) DEFAULT NULL,
    Manual tinyint(1) DEFAULT NULL,
    LastActivityAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND column_name = 'ActiveChannel'
    ) > 0,
    'ALTER TABLE Status DROP COLUMN ActiveChannel;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_status'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_status_status ON Status(Status);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND column_name = 'DNDEndTime'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Status ADD COLUMN DNDEndTime BIGINT;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND column_name = 'PrevStatus'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Status ADD COLUMN PrevStatus VARCHAR(32);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_user_id'
    ) > 0,
    'DROP INDEX idx_status_user_id ON Status;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
