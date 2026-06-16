-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_control_policies_type_id ON AccessControlPolicies(Type, Id);
