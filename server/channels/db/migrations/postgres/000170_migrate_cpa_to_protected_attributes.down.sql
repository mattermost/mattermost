-- Rename the group back to custom_profile_attributes.
UPDATE PropertyGroups
SET Name = 'custom_profile_attributes'
WHERE Name = 'protected_attributes';

-- Revert field metadata to the pre-migration state.
UPDATE PropertyFields
SET ObjectType        = '',
    TargetType        = '',
    PermissionField   = NULL,
    PermissionValues  = NULL,
    PermissionOptions = NULL
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes')
  AND ObjectType = 'user'
  AND TargetType = 'system';
