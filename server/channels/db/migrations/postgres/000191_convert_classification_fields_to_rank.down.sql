UPDATE PropertyFields
SET Type = 'select'
WHERE Type = 'rank'
  AND GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (Name = 'classification'         AND ObjectType = 'template')
     OR (Name = 'system_classification'  AND ObjectType = 'system')
     OR (Name = 'channel_classification' AND ObjectType = 'channel')
  );
