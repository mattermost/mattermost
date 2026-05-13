ALTER TABLE PropertyFields
    DROP COLUMN IF EXISTS PermissionFieldStr,
    DROP COLUMN IF EXISTS PermissionValuesStr,
    DROP COLUMN IF EXISTS PermissionOptionsStr;
