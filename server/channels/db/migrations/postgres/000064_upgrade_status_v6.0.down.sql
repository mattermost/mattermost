-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_status_status ON status(status);
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_status_status_dndendtime;
