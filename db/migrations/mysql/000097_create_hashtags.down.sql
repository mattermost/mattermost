SET @preparedStatement = (SELECT IF(
	(
	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
	WHERE table_name = 'Hashtags'
	AND table_schema = DATABASE()
	AND index_name = 'hashtags_value_fulltext'
	) > 0,
	'DROP INDEX hashtags_value_fulltext ON Hashtags;',
	'SELECT 1'
));
PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS Hashtags;
