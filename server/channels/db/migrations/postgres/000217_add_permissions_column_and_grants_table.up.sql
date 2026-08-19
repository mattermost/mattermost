-- Add permissions column to PropertyFields table to store the typed permissions
-- object (restrictions + masking) as JSONB. Nullable because permissions is
-- optional on a field.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS permissions jsonb NULL;

-- Create PropertyFieldGrants table to store normalized grants. The composite
-- primary key (FieldID, Type, ID, Action) is the reverse-lookup index used to
-- efficiently find all fields a given caller has access to.
CREATE TABLE IF NOT EXISTS PropertyFieldGrants (
	FieldID varchar(26) NOT NULL,
	Type varchar(64) NOT NULL,
	ID varchar(255) NOT NULL,
	Action varchar(64) NOT NULL,
	PRIMARY KEY (FieldID, Type, ID, Action)
);

-- Foreign key: cascading delete when a field is deleted.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_propertyfieldgrants_propertyfields') THEN
		ALTER TABLE PropertyFieldGrants
			ADD CONSTRAINT fk_propertyfieldgrants_propertyfields
			FOREIGN KEY (FieldID) REFERENCES PropertyFields (ID) ON DELETE CASCADE;
	END IF;
END;
$$;

-- Indexes for efficient lookup by FieldID (useful for field deletes and reading all grants for a field).
CREATE INDEX IF NOT EXISTS idx_propertyfieldgrants_fieldid ON PropertyFieldGrants (FieldID);
