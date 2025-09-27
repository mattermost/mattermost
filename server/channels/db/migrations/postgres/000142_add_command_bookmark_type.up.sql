-- Add 'command' to the channel_bookmark_type enum
DO
$$
BEGIN
  -- Check if 'command' value already exists in the enum
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'command' AND enumtypid = 'channel_bookmark_type'::regtype) THEN
    ALTER TYPE channel_bookmark_type ADD VALUE 'command';
  END IF;
END;
$$
LANGUAGE plpgsql;

-- Add command column to channelbookmarks table
ALTER TABLE channelbookmarks ADD COLUMN IF NOT EXISTS command text DEFAULT NULL;