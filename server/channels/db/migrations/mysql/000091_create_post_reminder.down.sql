SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PostReminders'
        AND table_schema = DATABASE()
        AND index_name = 'idx_postreminders_targettime'
    ) > 0,
    'DROP INDEX idx_postreminders_targettime ON PostReminders;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS PostReminders;