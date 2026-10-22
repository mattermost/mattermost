-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfields_unique_typed
    ON PropertyFields (ObjectType, GroupID, TargetType, TargetID, Name)
	WHERE DeleteAt = 0 AND ObjectType != '';
