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
