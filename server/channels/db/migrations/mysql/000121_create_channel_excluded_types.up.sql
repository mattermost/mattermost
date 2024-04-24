SET @preparedStatement = (SELECT IF(
	NOT EXISTS(
	SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
	WHERE table_name = 'Channels'
	AND table_schema = DATABASE()
	AND column_name = 'ExcludePostTypes'
	),
	'ALTER TABLE Channels ADD COLUMN ExcludePostTypes json;',
	'SELECT 1;'
	));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
