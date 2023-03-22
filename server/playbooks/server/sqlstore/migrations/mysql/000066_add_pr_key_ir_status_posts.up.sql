SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = (SELECT DATABASE())
        AND constraint_type = 'PRIMARY KEY'
    ),
    'ALTER TABLE IR_StatusPosts ADD PRIMARY KEY (IncidentID, PostID);',
    'SELECT 1;'
));

PREPARE addPrimaryKeyIfNotExists FROM @preparedStatement;
EXECUTE addPrimaryKeyIfNotExists;
DEALLOCATE PREPARE addPrimaryKeyIfNotExists;
