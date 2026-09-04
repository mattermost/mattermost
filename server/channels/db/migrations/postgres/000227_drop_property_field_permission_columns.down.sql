-- Restores the four columns empty. Schema rollback is safe and reversible.
-- Release rollback is not: a prior release decides permissions from these
-- columns, and empty values deny. Repopulate them from each field's
-- permissions object first — model.ProjectLegacyPermissions computes the
-- values, but no migration writes them back.
ALTER TABLE PropertyFields
ADD COLUMN IF NOT EXISTS Protected BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS PermissionField permission_level,
ADD COLUMN IF NOT EXISTS PermissionValues permission_level,
ADD COLUMN IF NOT EXISTS PermissionOptions permission_level;
