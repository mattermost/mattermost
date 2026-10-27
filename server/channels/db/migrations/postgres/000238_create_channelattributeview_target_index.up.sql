-- morph:nontransactional
-- One row per subject: the view groups by (GroupID, TargetID, TargetType), so
-- this key is unique. A unique index with no WHERE clause is what lets
-- RefreshAttributes use REFRESH MATERIALIZED VIEW CONCURRENTLY, which does not
-- block readers. TargetID leads so the bulk queries' joins on TargetID can use
-- it. Recreating the materialized view (as 000236 does) drops this index, so any
-- migration that recreates the view must recreate the index after it.
-- CONCURRENTLY cannot run inside a transaction, so this must be the only
-- statement in the file.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_channelattributeview_target ON ChannelAttributeView (TargetID, GroupID, TargetType);
