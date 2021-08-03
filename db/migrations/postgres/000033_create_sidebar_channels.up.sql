CREATE TABLE IF NOT EXISTS sidebarchannels (
    channelid VARCHAR(26),
    userid VARCHAR(26),
    categoryid VARCHAR(26),
    sortorder bigint,
    PRIMARY KEY (channelid, userid, categoryid)
);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'sidebarchannels'
    AND column_name = 'categoryid'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 128;

    IF col_exist_and_type_different THEN
        ALTER TABLE sidebarchannels ALTER COLUMN categoryid TYPE varchar(128);
    END IF;
END modify_column_type_if_type_is_different $$
