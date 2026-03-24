-- Drop the new indexes
DROP INDEX IF EXISTS idx_propertyfields_unique_typed;
DROP INDEX IF EXISTS idx_propertyfields_unique_legacy;

-- Restore the original unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_propertyfields_unique
    ON PropertyFields (GroupID, TargetID, Name)
    WHERE DeleteAt = 0;

ALTER TABLE PropertyFields DROP COLUMN IF EXISTS ObjectType;
