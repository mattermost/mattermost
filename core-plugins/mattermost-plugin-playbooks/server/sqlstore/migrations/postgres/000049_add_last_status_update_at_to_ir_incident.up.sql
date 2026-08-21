ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS LastStatusUpdateAt BIGINT DEFAULT 0;

UPDATE IR_Incident as dest
SET LastStatusUpdateAt = src.LastStatusUpdateAt
FROM (
  SELECT i.ID as ID, COALESCE(MAX(p.CreateAt), i.CreateAt) as LastStatusUpdateAt
  FROM IR_Incident as i
  LEFT JOIN IR_StatusPosts as sp on i.ID = sp.IncidentID
  LEFT JOIN Posts as p on sp.PostID = p.Id
  GROUP BY i.ID
) as src
WHERE dest.ID = src.ID;
