
CREATE PROCEDURE MigrateRootId_CommandWebhooks () BEGIN DECLARE ParentId_EXIST INT;
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'CommandWebhooks'
  AND table_schema = DATABASE()
  AND COLUMN_NAME = 'ParentId' INTO ParentId_EXIST;
IF(ParentId_EXIST > 0) THEN
    UPDATE CommandWebhooks SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
END IF;
END;

CALL MigrateRootId_CommandWebhooks ();
DROP PROCEDURE IF EXISTS MigrateRootId_CommandWebhooks;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'CommandWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'ALTER TABLE CommandWebhooks DROP COLUMN ParentId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
