SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Jobs'
        AND table_schema = DATABASE()
        AND index_name = 'idx_jobs_status_type'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_jobs_status_type ON Jobs(Status, Type);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
