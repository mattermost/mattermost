SET @preparedStatement = (SELECT IF(
	(
		SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
	) > 0,
	'ALTER TABLE teams DROP COLUMN IF EXISTS CloudLimitsArchived;',
	'SELECT 1'
))

PREPARE alterIfExists FROM @preparedStatment;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
