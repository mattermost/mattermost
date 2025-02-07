SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PropertyFields'
        AND table_schema = DATABASE()
        AND index_name = 'idx_propertyfields_create_at_id'
    ) > 0,
    'DROP INDEX idx_propertyfields_create_at_id ON PropertyFields;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
