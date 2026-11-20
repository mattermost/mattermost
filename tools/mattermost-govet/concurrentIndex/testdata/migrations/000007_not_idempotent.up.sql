-- A comment mentioning CREATE INDEX CONCURRENTLY is not a statement
CREATE INDEX CONCURRENTLY idx_no_if_not_exists ON t (c);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_ok ON t (d);
DROP INDEX CONCURRENTLY idx_no_if_exists;
-- DROP INDEX CONCURRENTLY mentioned in a comment
DROP INDEX CONCURRENTLY IF EXISTS idx_ok_old;
