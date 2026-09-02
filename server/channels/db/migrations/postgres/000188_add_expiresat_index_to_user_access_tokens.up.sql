-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_useraccesstokens_expiresat
    ON useraccesstokens (expiresat)
    WHERE expiresat > 0;
