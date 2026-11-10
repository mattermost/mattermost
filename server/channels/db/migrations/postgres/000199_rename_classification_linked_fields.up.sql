-- Rename the system- and channel-scoped classification linked fields so all
-- three classification fields share the canonical Name 'classification'. They
-- remain distinct rows because the typed unique index (idx_propertyfields_unique_typed)
-- keys on ObjectType as well, so template/system/channel rows do not collide.
UPDATE PropertyFields
SET Name = 'classification'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (Name = 'system_classification'  AND ObjectType = 'system')
     OR (Name = 'channel_classification' AND ObjectType = 'channel')
  );
