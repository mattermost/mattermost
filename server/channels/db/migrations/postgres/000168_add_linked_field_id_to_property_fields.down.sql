DROP INDEX IF EXISTS idx_propertyfields_linkedfieldid;
ALTER TABLE PropertyFields DROP COLUMN IF EXISTS LinkedFieldID;
