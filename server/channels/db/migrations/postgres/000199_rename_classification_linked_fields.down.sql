-- Restore the previous names so the rows can be matched by 000195's down
-- migration. Identified by ObjectType since all three classification rows
-- share the same Name='classification' at this point.
UPDATE PropertyFields
SET Name = 'system_classification'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND Name = 'classification'
  AND ObjectType = 'system';

UPDATE PropertyFields
SET Name = 'channel_classification'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND Name = 'classification'
  AND ObjectType = 'channel';
