-- morph:nontransactional
-- Parent lookups have always filtered on Data->'imports' containment without an
-- index to serve them, which meant a sequential scan per correlated subquery.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_control_policies_imports ON AccessControlPolicies USING GIN ((Data -> 'imports') jsonb_path_ops);
