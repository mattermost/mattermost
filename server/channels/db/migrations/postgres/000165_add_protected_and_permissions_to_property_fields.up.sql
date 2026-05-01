DO $$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'permission_level') THEN
    CREATE TYPE permission_level AS ENUM ('none', 'sysadmin', 'member');
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE PropertyFields
ADD COLUMN IF NOT EXISTS Protected BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS PermissionField permission_level,
ADD COLUMN IF NOT EXISTS PermissionValues permission_level,
ADD COLUMN IF NOT EXISTS PermissionOptions permission_level;
