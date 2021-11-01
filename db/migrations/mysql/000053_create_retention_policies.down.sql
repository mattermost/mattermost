SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPolicies'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPolicies_DisplayName'
    ) > 0,
    'DROP INDEX IDX_RetentionPolicies_DisplayName ON RetentionPolicies;',
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
        AND index_name = 'IDX_RetentionPolicies_DisplayName_Id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX IDX_RetentionPolicies_DisplayName_Id ON RetentionPolicies(DisplayName, Id);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE constraint_schema = DATABASE()
        AND constraint_name = 'FK_RetentionPoliciesChannels_RetentionPolicies'
        AND constraint_type = 'FOREIGN KEY'
    ) > 0,
    'ALTER TABLE RetentionPoliciesChannels DROP FOREIGN KEY FK_RetentionPoliciesChannels_RetentionPolicies',
    'SELECT 1;'
));

PREPARE dropForeignKeyIfNotExists FROM @preparedStatement;
EXECUTE dropForeignKeyIfNotExists;
DEALLOCATE PREPARE dropForeignKeyIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE constraint_schema = DATABASE()
        AND constraint_name = 'FK_RetentionPoliciesTeams_RetentionPolicies'
        AND constraint_type = 'FOREIGN KEY'
    ) > 0,
    'ALTER TABLE RetentionPoliciesTeams DROP FOREIGN KEY FK_RetentionPoliciesTeams_RetentionPolicies',
    'SELECT 1;'
));

PREPARE dropForeignKeyIfNotExists FROM @preparedStatement;
EXECUTE dropForeignKeyIfNotExists;
DEALLOCATE PREPARE dropForeignKeyIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPoliciesChannels'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPoliciesChannels_PolicyId'
    ) > 0,
    'DROP INDEX IDX_RetentionPoliciesChannels_PolicyId ON RetentionPoliciesChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RetentionPoliciesTeams'
        AND table_schema = DATABASE()
        AND index_name = 'IDX_RetentionPoliciesTeams_PolicyId'
    ) > 0,
    'DROP INDEX IDX_RetentionPoliciesTeams_PolicyId ON RetentionPoliciesTeams;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS RetentionPoliciesChannels;
DROP TABLE IF EXISTS RetentionPoliciesTeams;
DROP TABLE IF EXISTS RetentionPolicies;
