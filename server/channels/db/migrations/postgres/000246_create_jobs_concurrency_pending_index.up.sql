-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_concurrency_pending ON Jobs (ConcurrencyKey) WHERE Status = 'pending';
