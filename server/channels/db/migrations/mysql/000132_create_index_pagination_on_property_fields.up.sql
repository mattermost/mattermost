SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PropertyFields'
        AND table_schema = DATABASE()
        AND index_name = 'idx_propertyfields_create_at_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_propertyfields_create_at_id ON PropertyFields(CreateAt, ID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
