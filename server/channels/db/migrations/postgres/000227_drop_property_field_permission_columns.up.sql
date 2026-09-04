-- Drops Protected, PermissionField, PermissionValues, and PermissionOptions.
-- Nothing reads or writes these anymore; field permissions live in
-- PropertyFields.permissions and PropertyFieldGrants. The permission_level
-- type stays so a down migration can re-add the three enum columns.
ALTER TABLE PropertyFields
DROP COLUMN IF EXISTS Protected,
DROP COLUMN IF EXISTS PermissionField,
DROP COLUMN IF EXISTS PermissionValues,
DROP COLUMN IF EXISTS PermissionOptions;
