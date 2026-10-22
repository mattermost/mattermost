-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfields_linkedfieldid
    ON PropertyFields (LinkedFieldID) WHERE LinkedFieldID IS NOT NULL AND DeleteAt = 0;
