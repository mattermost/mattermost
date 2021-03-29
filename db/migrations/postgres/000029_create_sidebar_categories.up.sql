CREATE TABLE IF NOT EXISTS sidebarcategories (
    id VARCHAR(128),
    userid VARCHAR(26),
    teamid VARCHAR(26),
    sortorder bigint,
    sorting VARCHAR(64),
    type VARCHAR(64),
    displayname VARCHAR(64),
    muted boolean DEFAULT false,
    collapsed boolean DEFAULT false,
    PRIMARY KEY (id)
);

ALTER TABLE sidebarcategories ALTER COLUMN id TYPE VARCHAR(128);
ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false;
ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS collapsed boolean DEFAULT false;
