-- morph:nontransactional
-- Lives apart from 000245 because Postgres will not use an enum value in the
-- transaction that added it. CONCURRENTLY cannot run in a transaction either.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfields_key_prefix ON PropertyFields (GroupID, (Attrs->>'prefix')) WHERE Type = 'key' AND DeleteAt = 0;
