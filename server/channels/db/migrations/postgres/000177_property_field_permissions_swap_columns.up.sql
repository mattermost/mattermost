-- Step 3 of 3: retire the enum columns and adopt the varchar columns under the
-- original names, then drop the now-unused enum type. All operations here are
-- catalog-only (DROP COLUMN marks hidden, RENAME updates pg_attribute, DROP
-- TYPE removes the type entry); the transaction acquires ACCESS EXCLUSIVE on
-- PropertyFields only for the brief catalog updates, with no table rewrite.

ALTER TABLE PropertyFields
    DROP COLUMN IF EXISTS PermissionField,
    DROP COLUMN IF EXISTS PermissionValues,
    DROP COLUMN IF EXISTS PermissionOptions;

ALTER TABLE PropertyFields
    RENAME COLUMN PermissionFieldStr   TO PermissionField;
ALTER TABLE PropertyFields
    RENAME COLUMN PermissionValuesStr  TO PermissionValues;
ALTER TABLE PropertyFields
    RENAME COLUMN PermissionOptionsStr TO PermissionOptions;

DROP TYPE IF EXISTS permission_level;
