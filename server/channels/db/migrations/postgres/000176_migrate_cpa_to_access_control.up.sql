-- Update all fields belonging to the CPA group before renaming it.
-- Row-level locks only; bounded by the per-group field limit (~200 max).
-- PermissionValues is 'sysadmin' for admin-managed fields, 'member' for all
-- others so that regular users can write their own profile values through the
-- generic property API.
UPDATE PropertyFields
SET ObjectType        = 'user',
    TargetType        = 'system',
    PermissionField   = 'sysadmin',
    PermissionValues  = (CASE
                            WHEN Attrs->>'managed' = 'admin' THEN 'sysadmin'
                            ELSE 'member'
                        END)::permission_level,
    PermissionOptions = 'sysadmin'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes');

-- Rename the group and bump it to PSAv2. Single-row update, non-blocking.
-- The Version column was added in 000170; existing CPA groups default to V1.
UPDATE PropertyGroups
SET Name    = 'access_control',
    Version = 2
WHERE Name = 'custom_profile_attributes';
