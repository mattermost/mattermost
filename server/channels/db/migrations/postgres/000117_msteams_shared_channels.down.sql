ALTER TABLE RemoteClusters DROP COLUMN IF EXISTS PluginID;

ALTER TABLE SharedChannelRemotes DROP COLUMN IF EXISTS LastPostCreateAt;

ALTER TABLE SharedChannelRemotes DROP COLUMN IF EXISTS LastPostCreateID;

-- reverse column rename for 'lastpostid' only if `lastpostid` does not exist and 'lastpostupdateid' does exist
DO $$
<<rename_column_if_needed>>
DECLARE
    col_old_exist boolean := false;
    col_new_exist boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_old_exist
    FROM information_schema.columns
    WHERE table_name = 'sharedchannelremotes'
    AND table_schema = current_schema()
    AND column_name = 'lastpostupdateid';

    SELECT count(*) != 0 INTO col_new_exist
    FROM information_schema.columns
    WHERE table_name = 'sharedchannelremotes'
    AND table_schema = current_schema()
    AND column_name = 'lastpostid';

    IF col_old_exist AND NOT col_new_exist THEN
        ALTER TABLE sharedchannelremotes RENAME COLUMN lastpostupdateid TO lastpostid;
    END IF;
END rename_column_if_needed $$;
