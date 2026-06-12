-- NOTE: The 'W' value added to the channel_type enum in the up migration cannot be
-- removed in PostgreSQL. ALTER TYPE ... DROP VALUE is not supported. The 'W' enum
-- value will remain in the database after this rollback.
--
-- ROLLBACK SAFETY: If any ChannelTypeWiki (Type='W') rows exist in Channels,
-- a server version that predates this migration will fail on those rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM Channels WHERE Type = 'W') THEN
        RAISE EXCEPTION 'Cannot roll back migration 000179: wiki channels (Type=W) exist. Delete them first with: DELETE FROM Channels WHERE Type = ''W'';';
    END IF;
END $$;
