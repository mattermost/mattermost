-- Create extensions for hybrid search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
    objectId            varchar(26)    NOT NULL,    -- object ID (e.g., post ID)
    dstLang             varchar        NOT NULL,    -- ISO code from user preference
    objectType          varchar        NOT NULL,    -- e.g., 'post' (object-agnostic)
    providerId          varchar        NOT NULL,    -- 'agents' | 'libretranslate' | ...
    normHash            char(64)       NOT NULL,    -- sha256 (hex) of normalized source
    text                text           NOT NULL,    -- translated text (rehydrated)
    confidence          real                     ,  -- provider confidence 0..1 (nullable)
    meta                jsonb                    ,  -- provider metadata (nullable)
    updateAt            bigint         NOT NULL,    -- epoch millis
    contentSearchText   text                    ,  -- helper column for normalized search
    PRIMARY KEY (objectId, dstLang)
);

-- Indexes for recency and lookup performance
CREATE INDEX IF NOT EXISTS idx_translations_updateat
    ON translations (updateAt DESC);

-- Hybrid search indexes - FTS (full text search)
CREATE INDEX IF NOT EXISTS idx_translations_fts
    ON translations USING GIN (
        to_tsvector('simple', COALESCE(contentSearchText, text))
    );

-- Hybrid search indexes - Trigram for substring/typos/unsupported locales
CREATE INDEX IF NOT EXISTS idx_translations_trgm
    ON translations USING GIN (
        COALESCE(contentSearchText, text) gin_trgm_ops
    );

-- Add settings JSON bag to channels table
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS props jsonb NOT NULL DEFAULT '{}';

-- Type guard for autotranslation (direct boolean value)
-- Phase 1: Add constraint without validation (instant, minimal blocking)
ALTER TABLE channels
    ADD CONSTRAINT chk_channels_autotranslation_bool
    CHECK (
        NOT (props ? 'autotranslation')
        OR jsonb_typeof(props->'autotranslation') = 'boolean'
    ) NOT VALID;

-- Phase 2: Validate constraint (allows concurrent reads/writes, only blocks DDL)
ALTER TABLE channels
    VALIDATE CONSTRAINT chk_channels_autotranslation_bool;

-- Add preferences JSON bag to channelmembers table
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS props jsonb NOT NULL DEFAULT '{}';

-- Type guard for autotranslation (direct boolean value)
-- Phase 1: Add constraint without validation (instant, minimal blocking)
ALTER TABLE channelmembers
    ADD CONSTRAINT chk_channelmembers_autotranslation_bool
    CHECK (
        NOT (props ? 'autotranslation')
        OR jsonb_typeof(props->'autotranslation') = 'boolean'
    ) NOT VALID;

-- Phase 2: Validate constraint (allows concurrent reads/writes, only blocks DDL)
ALTER TABLE channelmembers
    VALIDATE CONSTRAINT chk_channelmembers_autotranslation_bool;

-- Hot path index: Members opted in for a channel (missing = false)
CREATE INDEX IF NOT EXISTS idx_channelmembers_autotranslation_enabled
    ON channelmembers (channelid)
    WHERE COALESCE((props->'autotranslation')::boolean, false) = true;

-- Covering index for GetActiveDestinationLanguages query
-- Allows index-only scans when fetching user locales (avoids heap access)
CREATE INDEX IF NOT EXISTS idx_users_id_locale
    ON users (id, locale);
