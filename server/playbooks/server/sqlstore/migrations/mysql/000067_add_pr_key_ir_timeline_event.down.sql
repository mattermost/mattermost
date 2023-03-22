SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE table_name = 'IR_TimelineEvent'
        AND table_schema = (SELECT DATABASE())
        AND constraint_type = 'PRIMARY KEY'
    ),
    'ALTER TABLE IR_TimelineEvent DROP PRIMARY KEY;',
    'SELECT 1;'
));

PREPARE dropPrimaryKeyIExists FROM @preparedStatement;
EXECUTE dropPrimaryKeyIExists;
DEALLOCATE PREPARE dropPrimaryKeyIExists;
