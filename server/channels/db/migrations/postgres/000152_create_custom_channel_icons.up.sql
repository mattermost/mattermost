CREATE TABLE IF NOT EXISTS customchannelicons (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    svg TEXT NOT NULL,
    normalizecolor BOOLEAN NOT NULL DEFAULT TRUE,
    createat BIGINT NOT NULL,
    updateat BIGINT NOT NULL,
    deleteat BIGINT NOT NULL DEFAULT 0,
    createdby VARCHAR(26) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customchannelicons_name ON customchannelicons(name);
CREATE INDEX IF NOT EXISTS idx_customchannelicons_deleteat ON customchannelicons(deleteat);
