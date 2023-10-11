-- Drop any existing TeamId column from 000094_threads_teamid.up.sql
 ALTER TABLE threads DROP COLUMN IF EXISTS teamid;

ALTER TABLE threads ADD COLUMN IF NOT EXISTS threadteamid VARCHAR(26);
UPDATE threads SET threadteamid = channels.teamid FROM channels WHERE threads.threadteamid IS NULL AND channels.id = threads.channelid;
