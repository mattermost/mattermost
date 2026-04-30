SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND index_name = 'idx_roles_scheme_id'
    ) > 0,
    'DROP INDEX idx_roles_scheme_id ON Roles;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
