-- morph:nontransactional
-- Resolve a name within a field. Deliberately no UNIQUE constraint: name
-- uniqueness spans a field and its link source, so it cannot be expressed as a
-- single-table unique key.
-- CONCURRENTLY cannot run inside a transaction, so this must be the only
-- statement in the file.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyoptions_fieldid_name ON PropertyOptions (FieldID, Name) WHERE DeleteAt = 0;
