-- concurrentIndex:ignore only REFRESH writes to a materialized view, so a plain
-- drop blocks no DML, and it keeps the down migration in one transaction.
DROP INDEX IF EXISTS idx_userattributeview_target;
-- concurrentIndex:ignore as above.
DROP INDEX IF EXISTS idx_channelattributeview_target;
