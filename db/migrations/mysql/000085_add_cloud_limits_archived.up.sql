SET @preparedStatement = (SELECT IF(
	(
		SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
	) > 0,
	'SELECT 1',
	'ALTER TABLE Teams ADD COLUMN CloudLimitsArchived BOOLEAN DEFAULT FALSE;'
));

PREPARE alterIfNotExists FROM @preparedStatment;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
