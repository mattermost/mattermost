-- Removing the space channel type. Channels with type S should be deleted
-- before running this migration. Postgres cannot drop a value from an existing
-- enum in place, so the 'S' value remains.
SELECT 1;
