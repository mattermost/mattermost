CREATE PROCEDURE AlterIndex()
BEGIN
    DECLARE columnName varchar(26) default '';

    SELECT IFNULL(GROUP_CONCAT(column_name ORDER BY seq_in_index), '') INTO columnName
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'UploadSessions'
    AND index_name = 'idx_uploadsessions_user_id'
    GROUP BY index_name;

    IF columnName = 'Type' THEN
        DROP INDEX idx_uploadsessions_user_id ON UploadSessions;
        CREATE INDEX idx_uploadsessions_user_id ON UploadSessions(UserId);
    END IF;
END;

CALL AlterIndex();

DROP PROCEDURE IF EXISTS AlterIndex;