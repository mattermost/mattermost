CREATE TABLE IF NOT EXISTS Teams (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    DisplayName varchar(64) DEFAULT NULL,
    Name varchar(64) DEFAULT NULL,
    Description varchar(255) DEFAULT NULL,
    Email varchar(128) DEFAULT NULL,
    Type varchar(255) DEFAULT NULL,
    CompanyName varchar(64) DEFAULT NULL,
    AllowedDomains text,
    InviteId varchar(32) DEFAULT NULL,
    SchemeId varchar(26) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name),
    KEY idx_teams_name (Name),
    KEY idx_teams_invite_id (InviteId),
    KEY idx_teams_update_at (UpdateAt),
    KEY idx_teams_create_at (CreateAt),
    KEY idx_teams_delete_at (DeleteAt),
    KEY idx_teams_scheme_id (SchemeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'AllowOpenInvite'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Teams ADD AllowOpenInvite bool;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'LastTeamIconUpdate'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Teams ADD LastTeamIconUpdate bigint;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'Description'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Teams ADD Description varchar(255);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'GroupConstrained'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Teams ADD GroupConstrained tinyint(1);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
