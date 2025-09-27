-- Remove command column from channelbookmarks table
ALTER TABLE channelbookmarks DROP COLUMN IF EXISTS command;

-- Note: PostgreSQL does not support removing enum values directly
-- The 'command' value will remain in the channel_bookmark_type enum
-- but will not cause issues since the column is removed