SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'IsDIsabled'
    ) > 0,
	'SELECT 1',
    'ALTER TABLE OAuthApps ADD COLUMN IsDisabled tinyint(1) DEFAULT 0;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
