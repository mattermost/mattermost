-- No default value - all inserts must explicitly provide a state
ALTER TABLE translations 
ADD COLUMN IF NOT EXISTS state varchar(20) NOT NULL;

-- Create partial index for non-terminal states (processing, unavailable)
-- This index is only for states that need monitoring/cleanup
CREATE INDEX IF NOT EXISTS idx_translations_state 
ON translations(state) 
WHERE state IN ('processing');
