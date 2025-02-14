SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PropertyValues'
        AND table_schema = DATABASE()
        AND index_name = 'idx_propertyvalues_create_at_id'
    ) > 0,
    'DROP INDEX idx_propertyvalues_create_at_id ON PropertyValues;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
