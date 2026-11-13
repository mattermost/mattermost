-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyvalues_groupid_fieldid ON PropertyValues(GroupID, FieldID) WHERE DeleteAt = 0;
