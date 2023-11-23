CREATE TABLE IF NOT EXISTS TeamMembers (
    TeamId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Roles varchar(64),
    DeleteAt bigint(20),
    PRIMARY KEY (TeamId, UserId),
    KEY idx_teammembers_user_id (UserId),
    KEY idx_teammembers_delete_at (DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeUser'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE TeamMembers ADD SchemeUser tinyint(4);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeAdmin'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE TeamMembers ADD SchemeAdmin tinyint(4);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeGuest'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE TeamMembers ADD SchemeGuest tinyint(4);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE TeamMembers ADD DeleteAt bigint(20);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_teammembers_team_id'
    ) > 0,
    'DROP INDEX idx_teammembers_team_id ON TeamMembers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
