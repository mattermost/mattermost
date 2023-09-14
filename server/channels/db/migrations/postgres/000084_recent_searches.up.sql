-- This table is unused, and will be dropped in a future ESR.
CREATE TABLE IF NOT EXISTS recentsearches (
    userid CHAR(26),
    searchpointer int,
    query jsonb,
    createat bigint NOT NULL,
    PRIMARY KEY (userid, searchpointer)
);
