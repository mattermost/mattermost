-- morph:nontransactional
-- Drop the partial index on the deprecated channelmembers autotranslation
-- column ahead of dropping the column itself in 000213. CONCURRENTLY cannot run
-- inside a transaction, so this must be the only statement in the file.
DROP INDEX CONCURRENTLY IF EXISTS idx_channelmembers_autotranslation_enabled;
