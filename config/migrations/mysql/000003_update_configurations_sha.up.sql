SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND column_name = 'SHA'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Configurations ADD COLUMN SHA varchar(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND index_name = 'idx_configurations_sha'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_configurations_sha ON Configurations(SHA);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE Migrate_Configuration_SHA ()
BEGIN
DECLARE
	SHA_NOT_EXIST INT;
	SELECT
		COUNT(*)
	FROM
		Configurations
	WHERE
		SHA = '';
	IF(SHA_NOT_EXIST > 0) THEN
		UPDATE
			Configurations
		SET
			SHA = SHA2(Value, 256)
		WHERE
			SHA = '';
		END IF;
END;
	CALL Migrate_Configuration_SHA ();
	DROP PROCEDURE IF EXISTS Migrate_Configuration_SHA;

