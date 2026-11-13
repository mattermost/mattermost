-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_concurrency_running ON Jobs (ConcurrencyKey) WHERE Status IN ('in_progress', 'cancel_requested');
