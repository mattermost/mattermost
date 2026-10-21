CREATE TABLE IF NOT EXISTS recentsearchqueries (
    id CHAR(26) PRIMARY KEY,
    userid CHAR(26) NOT NULL,
    terms TEXT NOT NULL,
    searchtype VARCHAR(16) NOT NULL,
    teamid CHAR(26) NOT NULL DEFAULT '',
    createat BIGINT NOT NULL,
    updateat BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recentsearchqueries_userid_terms_searchtype_teamid
    ON recentsearchqueries (userid, terms, searchtype, teamid);
CREATE INDEX IF NOT EXISTS idx_recentsearchqueries_userid_updateat
    ON recentsearchqueries (userid, updateat DESC);
