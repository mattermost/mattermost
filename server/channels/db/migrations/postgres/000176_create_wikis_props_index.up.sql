-- This migration slot originally created a GIN index on Wikis.Props. The index
-- was removed because no query pattern in wiki_store.go uses JSONB containment
-- or key-exists operators against Props. Re-introduce a matching index only when
-- a real query justifies it; a speculative GIN index is a pure build/maintenance
-- cost with no read benefit.
SELECT 1;
