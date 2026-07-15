-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyvalues_groupid_updateat_id ON PropertyValues(GroupID, UpdateAt, ID);
