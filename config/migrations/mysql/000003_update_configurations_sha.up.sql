SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND column_name = 'SHA'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Configurations ADD COLUMN SHA char(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
