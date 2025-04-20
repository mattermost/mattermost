SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PropertyValues'
        AND table_schema = DATABASE()
        AND index_name = 'idx_propertyvalues_create_at_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_propertyvalues_create_at_id ON PropertyValues(CreateAt, ID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
