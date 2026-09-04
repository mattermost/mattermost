-- morph:nontransactional
-- Load a field's live options in display order (also the keyset page key).
-- Deliberately no UNIQUE constraint: rank uniqueness is an application
-- invariant that may be relaxed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyoptions_fieldid_createat_id ON PropertyOptions (FieldID, CreateAt, ID) WHERE DeleteAt = 0;
