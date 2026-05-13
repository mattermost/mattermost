-- Step 2 of 3: backfill the new varchar columns from the existing enum columns.
-- Runs in its own transaction so only row-level locks are held — concurrent
-- readers and writers on PropertyFields are not blocked.

UPDATE PropertyFields
SET PermissionFieldStr   = PermissionField::text,
    PermissionValuesStr  = PermissionValues::text,
    PermissionOptionsStr = PermissionOptions::text
WHERE PermissionField   IS NOT NULL
   OR PermissionValues  IS NOT NULL
   OR PermissionOptions IS NOT NULL;
