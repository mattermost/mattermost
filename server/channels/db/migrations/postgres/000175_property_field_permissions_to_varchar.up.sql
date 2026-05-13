-- Step 1 of 3: add varchar columns alongside the existing permission_level
-- enum columns. Nullable + no DEFAULT, so this is a catalog-only operation in
-- PG 11+: brief ACCESS EXCLUSIVE on PropertyFields, no table rewrite.
-- Step 2 (000176) backfills, step 3 (000177) drops + renames.

ALTER TABLE PropertyFields
    ADD COLUMN IF NOT EXISTS PermissionFieldStr   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS PermissionValuesStr  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS PermissionOptionsStr VARCHAR(64);
