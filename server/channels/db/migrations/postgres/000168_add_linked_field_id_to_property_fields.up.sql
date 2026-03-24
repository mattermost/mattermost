ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS LinkedFieldID varchar(26);
CREATE INDEX IF NOT EXISTS idx_propertyfields_linkedfieldid
    ON PropertyFields (LinkedFieldID) WHERE LinkedFieldID IS NOT NULL AND DeleteAt = 0;
