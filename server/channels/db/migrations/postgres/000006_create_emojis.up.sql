CREATE TABLE IF NOT EXISTS emoji (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid VARCHAR(26),
    name VARCHAR(64),
    UNIQUE(name, deleteat)
);

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_emoji_update_at ON emoji (updateat);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_emoji_create_at ON emoji (createat);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_emoji_delete_at ON emoji (deleteat);

-- nolint:concurrentIndex
DROP INDEX IF EXISTS Name_2;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_emoji_name;
