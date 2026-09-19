-- Convert NULL PlaybookIDs back to empty strings for rollback
UPDATE IR_Incident SET PlaybookID = '' WHERE PlaybookID IS NULL;

-- Make PlaybookID NOT NULL again
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ir_incident'
        AND column_name = 'playbookid'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE IR_Incident ALTER COLUMN PlaybookID SET NOT NULL;
        ALTER TABLE IR_Incident ALTER COLUMN PlaybookID SET DEFAULT '';
    END IF;
END
$$;