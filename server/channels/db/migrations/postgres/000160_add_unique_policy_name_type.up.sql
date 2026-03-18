-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_accesscontrolpolicies_name_type ON AccessControlPolicies (Name, Type) WHERE Type = 'parent';
