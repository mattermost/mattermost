SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'BannerInfo'
    ),
    'ALTER TABLE Channels DROP COLUMN BannerInfo;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
