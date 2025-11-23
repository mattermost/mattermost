-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
    objectId            varchar(26)    NOT NULL,    -- object ID (e.g., post ID)
    dstLang             varchar        NOT NULL,    -- ISO code from user preference
    objectType          varchar        NULL,         -- e.g., 'post' (object-agnostic) if NULL assume "post"
    providerId          varchar        NOT NULL,    -- 'agents' | 'libretranslate' | ...
    normHash            char(64)       NOT NULL,    -- sha256 (hex) of normalized source
    text                text           NOT NULL,    -- translated text (rehydrated)
    confidence          real                     ,  -- provider confidence 0..1 (nullable)
    meta                jsonb                    ,  -- provider metadata (nullable)
    updateAt            bigint         NOT NULL,    -- epoch millis
    PRIMARY KEY (objectId, dstLang)
);

-- Index for recency and lookup performance
CREATE INDEX IF NOT EXISTS idx_translations_updateat
    ON translations (updateAt DESC);

-- Add autotranslation boolean column to channels table
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS autotranslation boolean NOT NULL DEFAULT false;

-- Add autotranslation boolean column to channelmembers table
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS autotranslation boolean NOT NULL DEFAULT false;

-- Hot path index: Members opted in for a channel
-- Partial index only includes rows where autotranslation is enabled for performance
CREATE INDEX IF NOT EXISTS idx_channelmembers_autotranslation_enabled
    ON channelmembers (channelid)
    WHERE autotranslation = true;

-- Index for efficient channel autotranslation lookups
CREATE INDEX IF NOT EXISTS idx_channels_autotranslation_enabled
    ON channels (id)
    WHERE autotranslation = true;

-- Covering index for GetActiveDestinationLanguages query
-- Allows index-only scans when fetching user locales (avoids heap access)
CREATE INDEX IF NOT EXISTS idx_users_id_locale
    ON users (id, locale);
