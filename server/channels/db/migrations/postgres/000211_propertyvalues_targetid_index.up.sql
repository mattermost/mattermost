-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyvalues_targetid_groupid_fieldid ON PropertyValues(TargetID, GroupID, FieldID) WHERE DeleteAt = 0;
