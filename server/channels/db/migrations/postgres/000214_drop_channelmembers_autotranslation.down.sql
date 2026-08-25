-- morph:nontransactional
-- Recreate the partial index on the channelmembers autotranslation column,
-- mirroring migration 000147. Runs after 000215 restores the column.
-- CONCURRENTLY cannot run inside a transaction, so this must be the only
-- statement in the file.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelmembers_autotranslation_enabled
    ON channelmembers (channelid)
    WHERE autotranslation = true;
