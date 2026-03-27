CREATE TABLE IF NOT EXISTS emoji (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid VARCHAR(26),
    name VARCHAR(64),
    UNIQUE(name, deleteat)
);

CREATE INDEX IF NOT EXISTS idx_emoji_update_at ON emoji (updateat);
CREATE INDEX IF NOT EXISTS idx_emoji_create_at ON emoji (createat);
CREATE INDEX IF NOT EXISTS idx_emoji_delete_at ON emoji (deleteat);

DROP INDEX IF EXISTS Name_2;

DROP INDEX IF EXISTS idx_emoji_name;
