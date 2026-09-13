-- Drop the RunID index if it exists
DROP INDEX IF EXISTS IR_MetricConfig_RunID;

-- Remove RunID column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ir_metricconfig'
        AND column_name = 'runid'
    ) THEN
        ALTER TABLE IR_MetricConfig DROP COLUMN RunID;
    END IF;
END
$$;