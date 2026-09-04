-- morph:nontransactional
-- Reverse-lookup index: the PK leads with FieldID, so it can't serve "which
-- fields may this caller act on" or "does this identity hold any grant" --
-- both filter by (Type, ID) without knowing FieldID. This index leads with
-- Type, ID instead, with Action appended so it also covers the
-- action-scoped lookup.
-- CONCURRENTLY cannot run inside a transaction, so this is its own
-- non-transactional migration rather than sitting in 000225 with the table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_propertyfieldgrants_type_id ON PropertyFieldGrants (Type, ID, Action);
