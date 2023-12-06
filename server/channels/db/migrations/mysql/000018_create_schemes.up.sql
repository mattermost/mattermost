CREATE TABLE IF NOT EXISTS Schemes (
    Id varchar(26) NOT NULL,
    Name varchar(64) DEFAULT NULL,
    DisplayName varchar(128) DEFAULT NULL,
    Description text,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    Scope varchar(32) DEFAULT NULL,
    DefaultTeamAdminRole varchar(64) DEFAULT NULL,
    DefaultTeamUserRole varchar(64) DEFAULT NULL,
    DefaultChannelAdminRole varchar(64) DEFAULT NULL,
    DefaultChannelUserRole varchar(64) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultTeamGuestRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD DefaultTeamGuestRole varchar(64);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultChannelGuestRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD DefaultChannelGuestRole varchar(64);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultTeamGuestRole'
    ) > 0,
    'ALTER TABLE Schemes MODIFY DefaultTeamGuestRole varchar(64);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultChannelGuestRole'
    ) > 0,
    'ALTER TABLE Schemes MODIFY DefaultChannelGuestRole varchar(64);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND index_name = 'idx_schemes_channel_guest_role'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_schemes_channel_guest_role ON Schemes(DefaultChannelGuestRole);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND index_name = 'idx_schemes_channel_user_role'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_schemes_channel_user_role ON Schemes(DefaultChannelUserRole);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND index_name = 'idx_schemes_channel_admin_role'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_schemes_channel_admin_role ON Schemes(DefaultChannelAdminRole);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
