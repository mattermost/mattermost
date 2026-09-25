-- Add RunID column to IR_MetricConfig to support metrics for standalone runs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ir_metricconfig'
        AND column_name = 'runid'
    ) THEN
        ALTER TABLE IR_MetricConfig ADD COLUMN RunID TEXT NULL;
    END IF;
END
$$;

-- Create index for RunID lookups
CREATE INDEX IF NOT EXISTS IR_MetricConfig_RunID ON IR_MetricConfig(RunID);