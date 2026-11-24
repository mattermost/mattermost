-- Delete everything that belongs to the post_attributes property group: its
-- values, option edges, options, fields (PropertyFieldGrants cascade with the
-- fields through their foreign key) and the group row itself.
DELETE FROM PropertyValues
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyOptionEdges
 WHERE FieldID IN (
    SELECT f.ID
      FROM PropertyFields f
      JOIN PropertyGroups g ON g.ID = f.GroupID
     WHERE g.Name = 'post_attributes'
 );

DELETE FROM PropertyOptions
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyFields
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyGroups WHERE Name = 'post_attributes';

-- Post fields already in access_control are unlikely to exist. Any that do are
-- moved from member to the new creator default.
UPDATE PropertyFields
   SET PermissionValues = 'creator',
       Permissions = CASE
           WHEN Permissions IS NULL THEN NULL
           ELSE jsonb_set(Permissions, '{restrictions,value,write}', '"creator"')
       END
 WHERE ObjectType = 'post'
   AND GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
   AND (
        (Permissions IS NULL AND PermissionValues = 'member')
        OR Permissions #>> '{restrictions,value,write}' = 'member'
   );
