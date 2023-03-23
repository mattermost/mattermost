{{if and .mysql .plugin}}
    -- this migration applies collation on column level.
    -- collation of mattermost's Channels table
    SET @mattermostCollation = (SELECT table_collation from information_schema.tables WHERE table_name = 'Channels' AND table_schema = (SELECT DATABASE()));
    -- charset of mattermost's CHannels table's Name column
    SET @mattermostCharset = (SELECT CHARACTER_SET_NAME from information_schema.columns WHERE table_name = 'Channels' AND table_schema = (SELECT DATABASE()) AND COLUMN_NAME = 'Name');

    -- blocks
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}blocks CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- blocks history
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}blocks_history CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- sessions
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}sessions CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- sharing
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}sharing CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- system settings
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}system_settings CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- users
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}users CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- workspaces
    SET @updateCollationQuery = CONCAT('ALTER TABLE {{.prefix}}workspaces CONVERT TO CHARACTER SET ', @mattermostCharset, ' COLLATE ', @mattermostCollation);
    PREPARE stmt FROM @updateCollationQuery;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
{{else}}
    -- We need a query here otherwise the migration will result
    -- in an empty query when the if condition is false.
    -- Empty query causes a "Query was empty" error.
    SELECT 1;
{{end}}
