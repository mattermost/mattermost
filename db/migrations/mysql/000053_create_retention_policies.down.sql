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

DROP TABLE IF EXISTS RetentionPoliciesChannels;
DROP TABLE IF EXISTS RetentionPoliciesTeams;
DROP TABLE IF EXISTS RetentionPolicies;
