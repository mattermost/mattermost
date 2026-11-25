-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passkeys_userid ON passkeys (userid);
