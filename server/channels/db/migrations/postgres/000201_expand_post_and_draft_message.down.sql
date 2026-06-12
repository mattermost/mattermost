DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM Posts WHERE char_length(Message) > 65535 LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back migration 000183: Posts.Message contains values longer than 65535 characters. Truncation would occur.';
  END IF;
  IF EXISTS (SELECT 1 FROM Drafts WHERE char_length(Message) > 65535 LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back migration 000183: Drafts.Message contains values longer than 65535 characters. Truncation would occur.';
  END IF;
END $$;
SET lock_timeout = '5s';
ALTER TABLE Posts ALTER COLUMN Message TYPE VARCHAR(65535);
ALTER TABLE Drafts ALTER COLUMN Message TYPE VARCHAR(65535);
RESET lock_timeout;
