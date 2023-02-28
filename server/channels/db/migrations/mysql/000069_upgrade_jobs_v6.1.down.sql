
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Jobs'
        AND table_schema = DATABASE()
        AND index_name = 'idx_jobs_status_type'
    ) > 0,
    'DROP INDEX idx_jobs_status_type ON Jobs;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
