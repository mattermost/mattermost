SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND index_name = 'idx_roles_scheme_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_roles_scheme_id ON Roles(SchemeId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
