SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'VoipDeviceId'
    ),
    'ALTER TABLE Sessions ADD COLUMN VoipDeviceId character varying(512) NOT NULL DEFAULT '''';',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
