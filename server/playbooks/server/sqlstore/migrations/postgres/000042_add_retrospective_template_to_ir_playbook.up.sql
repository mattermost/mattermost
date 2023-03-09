ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS RetrospectiveTemplate TEXT;

UPDATE IR_Playbook 
SET RetrospectiveTemplate = ''
WHERE RetrospectiveTemplate IS NULL
