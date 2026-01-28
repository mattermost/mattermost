ALTER TABLE PropertyFields
ADD COLUMN IF NOT EXISTS Protected BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS Permissions JSONB;

CREATE INDEX IF NOT EXISTS idx_propertyfields_protected
    ON PropertyFields (Protected)
    WHERE Protected = true;
