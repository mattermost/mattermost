ALTER TABLE PropertyFields
DROP COLUMN IF EXISTS PermissionOptions,
DROP COLUMN IF EXISTS PermissionValues,
DROP COLUMN IF EXISTS PermissionField,
DROP COLUMN IF EXISTS Protected;

DROP TYPE IF EXISTS permission_level;
