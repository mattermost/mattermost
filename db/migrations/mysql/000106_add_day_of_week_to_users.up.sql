SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'FirstDayOfWeek'
    ),
	'ALTER TABLE Users ADD FirstDayOfWeek integer DEFAULT 0;'
    'SELECT 1',
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
