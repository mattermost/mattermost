ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS CategoryName TEXT DEFAULT '';

UPDATE IR_Incident 
SET CategoryName = 'Playbook Runs' 
WHERE CategorizeChannelEnabled;
