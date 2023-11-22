ALTER TABLE SharedChannelRemotes ADD COLUMN IF NOT EXISTS LastPostCreateAt bigint NOT NULL DEFAULT 0;

ALTER TABLE SharedChannelRemotes ADD COLUMN IF NOT EXISTS LastPostCreateID VARCHAR(26);

-- rename column 'lastpostid' only if old name exists and new name does not
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
    AND column_name = 'lastpostid';

    SELECT count(*) != 0 INTO col_new_exist
    FROM information_schema.columns
    WHERE table_name = 'sharedchannelremotes'
    AND table_schema = current_schema()
    AND column_name = 'lastpostupdateid';

    IF col_old_exist AND NOT col_new_exist THEN
        ALTER TABLE sharedchannelremotes RENAME COLUMN lastpostid TO lastpostupdateid;
    END IF;
END rename_column_if_needed $$;
