-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyvalues_targetid_groupid ON PropertyValues(TargetID, GroupID);
