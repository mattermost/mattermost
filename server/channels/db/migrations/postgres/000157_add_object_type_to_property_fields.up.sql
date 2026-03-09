ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS ObjectType varchar(255) NOT NULL DEFAULT '';

-- Drop the old unique index that doesn't account for ObjectType
DROP INDEX IF EXISTS idx_propertyfields_unique;

-- Legacy uniqueness for properties without ObjectType (PSAv1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_propertyfields_unique_legacy
    ON PropertyFields (GroupID, TargetID, Name)
    WHERE DeleteAt = 0 AND ObjectType = '';

-- Typed uniqueness for properties with ObjectType (hierarchical model, PSAv2)
CREATE UNIQUE INDEX IF NOT EXISTS idx_propertyfields_unique_typed
    ON PropertyFields (ObjectType, GroupID, TargetType, TargetID, Name)
    WHERE DeleteAt = 0 AND ObjectType != '';
