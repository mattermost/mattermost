-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfields_unique
    ON PropertyFields (GroupID, TargetID, Name)
	WHERE DeleteAt = 0;
