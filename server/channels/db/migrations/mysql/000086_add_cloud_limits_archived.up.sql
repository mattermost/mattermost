SET @preparedStatement = (SELECT IF(
	NOT EXISTS(
		SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
	),
	'ALTER TABLE Teams ADD COLUMN CloudLimitsArchived BOOLEAN NOT NULL DEFAULT FALSE;',
	'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
