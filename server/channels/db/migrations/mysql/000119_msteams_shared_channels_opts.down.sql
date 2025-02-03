SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'Options'
    ),
    'ALTER TABLE RemoteClusters DROP COLUMN Options;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;

