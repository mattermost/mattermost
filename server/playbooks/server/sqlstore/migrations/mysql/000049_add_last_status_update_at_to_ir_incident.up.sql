SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'LastStatusUpdateAt'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN LastStatusUpdateAt BIGINT DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Incident as dest, 
(
    SELECT i.ID as ID, COALESCE(MAX(p.CreateAt), i.CreateAt) as LastStatusUpdateAt
    FROM IR_Incident as i
    LEFT JOIN IR_StatusPosts as sp on i.ID = sp.IncidentID
    LEFT JOIN Posts as p on sp.PostID = p.Id
    GROUP BY i.ID
) as src
SET dest.LastStatusUpdateAt = src.LastStatusUpdateAt
WHERE dest.ID = src.ID;
