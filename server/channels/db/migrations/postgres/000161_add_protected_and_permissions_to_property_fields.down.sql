DROP INDEX IF EXISTS idx_propertyfields_protected;

ALTER TABLE PropertyFields
DROP COLUMN IF EXISTS Permissions,
DROP COLUMN IF EXISTS Protected;
