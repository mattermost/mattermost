-- Drop the PropertyFieldGrants table.
DROP TABLE IF EXISTS PropertyFieldGrants;

-- Remove the permissions column from PropertyFields table.
ALTER TABLE PropertyFields DROP COLUMN IF EXISTS permissions;
