CREATE TABLE IF NOT EXISTS RetentionPolicies (
	Id varchar(26) NOT NULL,
	DisplayName varchar(64) DEFAULT NULL,
	PostDuration  bigint(20) DEFAULT NULL,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS RetentionPoliciesTeams (
	PolicyId varchar(26) DEFAULT NULL,
    TeamId varchar(26) NOT NULL,
    PRIMARY KEY (TeamId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS RetentionPoliciesChannels (
	PolicyId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) NOT NULL,
    PRIMARY KEY (ChannelId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE constraint_schema = DATABASE()
        AND constraint_name = 'FK_RetentionPoliciesTeams_RetentionPolicies'
        AND constraint_type = 'FOREIGN KEY'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE RetentionPoliciesTeams ADD CONSTRAINT FK_RetentionPoliciesTeams_RetentionPolicies FOREIGN KEY (PolicyId) REFERENCES RetentionPolicies (Id) ON DELETE CASCADE;'
));

PREPARE createForeignKeyIfNotExists FROM @preparedStatement;
EXECUTE createForeignKeyIfNotExists;
DEALLOCATE PREPARE createForeignKeyIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE constraint_schema = DATABASE()
        AND constraint_name = 'FK_RetentionPoliciesChannels_RetentionPolicies'
        AND constraint_type = 'FOREIGN KEY'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE RetentionPoliciesChannels ADD CONSTRAINT FK_RetentionPoliciesChannels_RetentionPolicies FOREIGN KEY (PolicyId) REFERENCES RetentionPolicies (Id) ON DELETE CASCADE;'
));

PREPARE createForeignKeyIfNotExists FROM @preparedStatement;
EXECUTE createForeignKeyIfNotExists;
DEALLOCATE PREPARE createForeignKeyIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPoliciesTeams'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPoliciesTeams_PolicyId'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX IDX_RetentionPoliciesTeams_PolicyId ON RetentionPoliciesTeams(PolicyId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPoliciesChannels'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPoliciesChannels_PolicyId'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX IDX_RetentionPoliciesChannels_PolicyId ON RetentionPoliciesChannels(PolicyId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPolicies'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPolicies_DisplayName_Id'
    ) > 0,
    'DROP INDEX IDX_RetentionPolicies_DisplayName_Id ON RetentionPolicies;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPolicies'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPolicies_DisplayName'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX IDX_RetentionPolicies_DisplayName ON RetentionPolicies(DisplayName);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
