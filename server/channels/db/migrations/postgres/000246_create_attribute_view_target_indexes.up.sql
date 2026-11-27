-- Unique indexes on the attribute materialized views, so they can be refreshed
-- with REFRESH MATERIALIZED VIEW CONCURRENTLY.
--
-- A plain refresh takes an ACCESS EXCLUSIVE lock for the whole rebuild, so every
-- reader of the view waits for it (about 9 s at 100k users). A concurrent refresh
-- lets readers keep reading the old contents, but Postgres refuses it unless the
-- view has a valid unique index.
--
-- The key is the views' grouping columns (GROUP BY GroupID, TargetID,
-- TargetType), so it is unique by construction and the build can't fail.
-- TargetID leads because the bulk readers join the view on it.
--
-- A plain CREATE INDEX is fine here: on a materialized view only REFRESH writes,
-- and the build's SHARE lock doesn't block readers. It may wait behind a refresh
-- that is already running.
--
-- Any later migration that drops and recreates either view must recreate its
-- index, or every refresh of that view fails.

-- concurrentIndex:ignore only REFRESH writes to a materialized view, so a plain
-- build blocks no DML, and a failed CONCURRENTLY build would leave an invalid
-- index that IF NOT EXISTS then skips on retry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_userattributeview_target ON UserAttributeView (TargetID, GroupID, TargetType);
-- concurrentIndex:ignore as above.
CREATE UNIQUE INDEX IF NOT EXISTS idx_channelattributeview_target ON ChannelAttributeView (TargetID, GroupID, TargetType);
