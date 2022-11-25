DO $$
<<migrate_root_id_command_webhooks>>
DECLARE 
    parentid_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO parentid_exist
    FROM information_schema.columns
    WHERE table_name = 'commandwebhooks'
    AND table_schema = current_schema()
    AND column_name = 'parentid';
IF parentid_exist THEN
    UPDATE commandwebhooks SET rootid = parentid WHERE rootid = '' AND rootid != parentid;
END IF;
END migrate_root_id_command_webhooks $$;

ALTER TABLE commandwebhooks DROP COLUMN IF EXISTS parentid;
