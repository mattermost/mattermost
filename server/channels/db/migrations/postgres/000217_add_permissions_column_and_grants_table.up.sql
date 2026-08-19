-- Nullable because permissions is optional on a field; holds the typed
-- restrictions+masking object as JSONB.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS permissions jsonb NULL;

-- The composite primary key (FieldID, Type, ID, Action) serves the forward
-- direction -- reading all grants for a known field.
CREATE TABLE IF NOT EXISTS PropertyFieldGrants (
	FieldID varchar(26) NOT NULL,
	Type varchar(64) NOT NULL,
	ID varchar(255) NOT NULL,
	Action varchar(64) NOT NULL,
	PRIMARY KEY (FieldID, Type, ID, Action)
);

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_propertyfieldgrants_propertyfields') THEN
		ALTER TABLE PropertyFieldGrants
			ADD CONSTRAINT fk_propertyfieldgrants_propertyfields
			FOREIGN KEY (FieldID) REFERENCES PropertyFields (ID) ON DELETE CASCADE;
	END IF;
END;
$$;

-- Reverse-lookup index: the PK leads with FieldID, so it can't serve "which
-- fields may this caller act on" or "does this identity hold any grant" --
-- both filter by (Type, ID) without knowing FieldID. This index leads with
-- Type, ID instead, with Action appended so it also covers the
-- action-scoped lookup.
CREATE INDEX IF NOT EXISTS idx_propertyfieldgrants_type_id ON PropertyFieldGrants (Type, ID, Action);
