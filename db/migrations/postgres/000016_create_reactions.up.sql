CREATE TABLE IF NOT EXISTS reactions(
    userid VARCHAR(26) NOT NULL,
    postid VARCHAR(26) NOT NULL,
    emojiname VARCHAR(64) NOT NULL,
    createat bigint
);

ALTER TABLE reactions ADD COLUMN IF NOT EXISTS updateat bigint;
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS deleteat bigint;

DO $$
<<alter_pk>>
DECLARE
    existing_index text;
BEGIN
    SELECT string_agg(a.attname, ',') INTO existing_index
    FROM pg_constraint AS c
    CROSS JOIN
        (SELECT unnest(conkey) FROM pg_constraint WHERE conrelid = 'reactions'::regclass AND contype='p') AS cols(colnum)
    INNER JOIN pg_attribute AS a ON a.attrelid = c.conrelid AND cols.colnum = a.attnum
    WHERE c.contype = 'p'
    AND c.conrelid = 'reactions'::regclass;

    IF COALESCE (existing_index, '') <> text('postid,userid,emojiname') THEN
        ALTER TABLE reactions
            DROP CONSTRAINT IF EXISTS reactions_pkey,
            ADD PRIMARY KEY (postid, userid, emojiname);
    END IF;
END alter_pk $$;

ALTER TABLE reactions ADD COLUMN IF NOT EXISTS remoteid VARCHAR(26);
