SET @preparedStatement = (SELECT IF(
    (
	SELECT row_format FROM INFORMATION_SCHEMA.TABLES
	WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
	) != 'Compressed'
AND
	(
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'TeamId'
    ) > 0 ,
    'ALTER TABLE Threads DROP COLUMN TeamId, ALGORITHM=INSTANT',
    'SELECT 1'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
