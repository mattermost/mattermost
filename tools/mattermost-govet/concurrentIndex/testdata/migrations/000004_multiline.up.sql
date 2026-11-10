CREATE INDEX
    IF NOT EXISTS idx_multiline
    ON foo (bar);
DROP INDEX CONCURRENTLY IF EXISTS idx_multiline_ok;
