CREATE PROCEDURE AlterIndex()
BEGIN
    DECLARE columnName varchar(26) default '';

    SELECT IFNULL(GROUP_CONCAT(column_name ORDER BY seq_in_index), '') INTO columnName
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'UserTermsOfService'
    AND index_name = 'PRIMARY'

    IF columnName != 'UserId' THEN
        DELETE E FROM UserTermsOfService E INNER JOIN
            (
                SELECT *, RANK() OVER(PARTITION BY UserId ORDER BY CreateAt DESC) utosRank FROM UserTermsOfService
            ) T ON E.UserId = t.UserId && E.TermsOfServiceId = t.TermsOfServiceId
            WHERE utosRank > 1;
        ALTER TABLE UserTermsOfService DROP PRIMARY KEY, ADD PRIMARY KEY(UserId);
    END IF;
END;

CALL AlterIndex();

DROP PROCEDURE IF EXISTS AlterIndex;
