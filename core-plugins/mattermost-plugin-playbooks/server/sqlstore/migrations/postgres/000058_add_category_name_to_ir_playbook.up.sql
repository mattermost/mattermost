ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS CategoryName TEXT DEFAULT '';

UPDATE IR_Playbook 
SET CategoryName = 'Playbook Runs' 
WHERE CategorizeChannelEnabled;
