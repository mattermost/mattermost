SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'Options'
    ),
    'ALTER TABLE RemoteClusters ADD COLUMN Options smallint NOT NULL DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

