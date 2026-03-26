-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_status_status_dndendtime ON status(status, dndendtime);
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_status_status;
