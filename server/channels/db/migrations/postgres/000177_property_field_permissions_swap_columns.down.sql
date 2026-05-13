-- Reverse 000177: re-create the permission_level ENUM, rename the live varchar
-- columns back to *Str, and re-add the enum columns under the original names.
-- Backfill copies legacy values across; permission IDs outside the enum become
-- NULL (the enum cannot represent them).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'permission_level') THEN
    CREATE TYPE permission_level AS ENUM ('none', 'sysadmin', 'member');
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE PropertyFields
    RENAME COLUMN PermissionField   TO PermissionFieldStr;
ALTER TABLE PropertyFields
    RENAME COLUMN PermissionValues  TO PermissionValuesStr;
ALTER TABLE PropertyFields
    RENAME COLUMN PermissionOptions TO PermissionOptionsStr;

ALTER TABLE PropertyFields
    ADD COLUMN IF NOT EXISTS PermissionField   permission_level,
    ADD COLUMN IF NOT EXISTS PermissionValues  permission_level,
    ADD COLUMN IF NOT EXISTS PermissionOptions permission_level;

UPDATE PropertyFields
SET PermissionField = CASE
        WHEN PermissionFieldStr IN ('none', 'sysadmin', 'member') THEN PermissionFieldStr::permission_level
        ELSE NULL
    END,
    PermissionValues = CASE
        WHEN PermissionValuesStr IN ('none', 'sysadmin', 'member') THEN PermissionValuesStr::permission_level
        ELSE NULL
    END,
    PermissionOptions = CASE
        WHEN PermissionOptionsStr IN ('none', 'sysadmin', 'member') THEN PermissionOptionsStr::permission_level
        ELSE NULL
    END;
