-- Make PlaybookID nullable in PostgreSQL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ir_incident'
        AND column_name = 'playbookid'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE IR_Incident ALTER COLUMN PlaybookID DROP NOT NULL;
        ALTER TABLE IR_Incident ALTER COLUMN PlaybookID SET DEFAULT NULL;
    END IF;
END
$$;

-- Update existing empty string PlaybookIDs to NULL for cleaner data
UPDATE IR_Incident SET PlaybookID = NULL WHERE PlaybookID = '';