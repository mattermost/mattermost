SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'UpdateAt'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN UpdateAt BIGINT NOT NULL DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Playbook
SET UpdateAt = CreateAt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND index_name = 'IR_Playbook_UpdateAt'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX IR_Playbook_UpdateAt ON IR_Playbook(UpdateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;