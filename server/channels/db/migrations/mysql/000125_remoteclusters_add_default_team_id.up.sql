SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultTeamId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE RemoteClusters ADD DefaultTeamId VARCHAR(26) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
