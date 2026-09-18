-- morph:nontransactional
-- Supports the containment predicate that finds policies whose membership rule
-- opts into auto-adding members, which runs as a correlated subquery when
-- hydrating channel and team lists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_control_policies_rules ON AccessControlPolicies USING GIN ((Data -> 'rules') jsonb_path_ops);
