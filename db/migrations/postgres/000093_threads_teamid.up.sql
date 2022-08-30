ALTER TABLE threads ADD COLUMN IF NOT EXISTS teamid VARCHAR(26);
UPDATE threads SET teamid = channels.teamid FROM channels WHERE threads.teamid IS NULL AND channels.id = threads.channelid;
