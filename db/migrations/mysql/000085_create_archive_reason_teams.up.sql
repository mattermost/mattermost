SET @preparedStatement = (SELECT IF(
	(
		SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
	) < 0,
	'ALTER TABLE Teams ADD COLUMN CloudLimitsArchived bool DEFAULT FALSE;'
))

PREPARE alterIfExists FROM @preparedStatment;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
