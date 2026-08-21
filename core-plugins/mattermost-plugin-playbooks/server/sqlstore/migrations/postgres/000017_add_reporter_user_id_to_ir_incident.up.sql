ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS ReporterUserID TEXT NOT NULL DEFAULT '';

UPDATE IR_Incident 
SET ReporterUserID = CommanderUserID
WHERE ReporterUserID = ''
