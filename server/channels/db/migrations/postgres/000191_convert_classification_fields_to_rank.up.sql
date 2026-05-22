-- Convert the classification-markings property fields from 'select' to 'rank'.
-- Each (Name, ObjectType) pair is matched explicitly so unrelated fields that
-- happen to share a name cannot be touched. At most three rows are updated.
UPDATE PropertyFields
SET Type = 'rank'
WHERE Type = 'select'
  AND GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (Name = 'classification'         AND ObjectType = 'template')
     OR (Name = 'system_classification'  AND ObjectType = 'system')
     OR (Name = 'channel_classification' AND ObjectType = 'channel')
  );
