CREATE TABLE IF NOT EXISTS statusnotificationrules (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    watcheduserid VARCHAR(26) NOT NULL,
    recipientuserid VARCHAR(26) NOT NULL,
    eventfilters VARCHAR(512) NOT NULL DEFAULT '',
    createat BIGINT NOT NULL,
    updateat BIGINT NOT NULL,
    deleteat BIGINT DEFAULT 0,
    createdby VARCHAR(26) NOT NULL
);

-- Index for efficiently finding rules by watched user (critical for performance)
CREATE INDEX IF NOT EXISTS idx_statusnotificationrules_watcheduserid ON statusnotificationrules(watcheduserid);

-- Index for finding enabled rules (excludes deleted)
CREATE INDEX IF NOT EXISTS idx_statusnotificationrules_enabled ON statusnotificationrules(enabled) WHERE deleteat = 0;

-- Composite index for common query pattern: enabled rules for a specific watched user
CREATE INDEX IF NOT EXISTS idx_statusnotificationrules_watcheduserid_enabled ON statusnotificationrules(watcheduserid, enabled) WHERE deleteat = 0;
