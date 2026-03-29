-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfields_unique_legacy
    ON PropertyFields (GroupID, TargetID, Name)
	WHERE DeleteAt = 0 AND ObjectType = '';
