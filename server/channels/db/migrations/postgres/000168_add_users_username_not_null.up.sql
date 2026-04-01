-- Backfill any NULL or empty username records before applying constraint.
-- Uses 'user_' prefix + user ID to generate a unique, valid username.
UPDATE users SET username = 'user_' || id WHERE username IS NULL OR trim(username) = '';

-- Add NOT NULL constraint to prevent future NULL usernames.
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Add CHECK constraint to prevent empty/whitespace-only usernames.
ALTER TABLE users ADD CONSTRAINT users_username_not_empty CHECK (length(trim(username)) > 0);
