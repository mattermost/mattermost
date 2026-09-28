-- Postgres cannot remove a value from an existing enum in place, so rebuild the
-- type without 'creator'. Any rows currently holding 'creator' are coerced to
-- NULL first so the recreated enum can accept them.

UPDATE PropertyFields SET PermissionField   = NULL WHERE PermissionField   = 'creator';
UPDATE PropertyFields SET PermissionValues  = NULL WHERE PermissionValues  = 'creator';
UPDATE PropertyFields SET PermissionOptions = NULL WHERE PermissionOptions = 'creator';

ALTER TYPE permission_level RENAME TO permission_level_old;

CREATE TYPE permission_level AS ENUM ('none', 'sysadmin', 'member', 'admin');

ALTER TABLE PropertyFields
    ALTER COLUMN PermissionField   TYPE permission_level USING PermissionField::text::permission_level,
    ALTER COLUMN PermissionValues  TYPE permission_level USING PermissionValues::text::permission_level,
    ALTER COLUMN PermissionOptions TYPE permission_level USING PermissionOptions::text::permission_level;

DROP TYPE permission_level_old;
