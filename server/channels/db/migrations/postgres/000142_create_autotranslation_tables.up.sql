-- Create extensions for hybrid search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
    object_type         varchar        NOT NULL,    -- e.g., 'post' (object-agnostic)
    object_id           varchar(26)    NOT NULL,    -- post ID (text)
    dst_lang            varchar        NOT NULL,    -- ISO code from user preference
    provider_id         varchar        NOT NULL,    -- 'agents' | 'libretranslate' | ...
    norm_hash           char(64)       NOT NULL,    -- sha256 (hex) of normalized source
    text                text           NOT NULL,    -- translated text (rehydrated)
    confidence          real                     ,  -- provider confidence 0..1 (nullable)
    meta                jsonb                    ,  -- provider metadata (nullable)
    updateat            bigint         NOT NULL,    -- epoch millis
    content_search_text text                    ,  -- helper column for normalized search
    PRIMARY KEY (object_type, object_id, dst_lang)
);

-- Indexes for recency and lookup performance
CREATE INDEX IF NOT EXISTS idx_translations_updateat 
    ON translations (updateat DESC);

-- Hybrid search indexes - FTS (full text search)
CREATE INDEX IF NOT EXISTS idx_translations_fts
    ON translations USING GIN (
        to_tsvector('simple', COALESCE(content_search_text, text))
    );

-- Hybrid search indexes - Trigram for substring/typos/unsupported locales
CREATE INDEX IF NOT EXISTS idx_translations_trgm
    ON translations USING GIN (
        COALESCE(content_search_text, text) gin_trgm_ops
    );

-- Add settings JSON bag to channels table
ALTER TABLE channels 
    ADD COLUMN IF NOT EXISTS props jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Type guard for autotranslation (direct boolean value)
ALTER TABLE channels
    ADD CONSTRAINT chk_channels_autotranslation_bool
    CHECK (
        NOT (props ? 'autotranslation')
        OR jsonb_typeof(props->'autotranslation') = 'boolean'
    );

-- Add preferences JSON bag to channelmembers table
ALTER TABLE channelmembers 
    ADD COLUMN IF NOT EXISTS props jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Type guard for autotranslation (direct boolean value)
ALTER TABLE channelmembers
    ADD CONSTRAINT chk_channelmembers_autotranslation_bool
    CHECK (
        NOT (props ? 'autotranslation')
        OR jsonb_typeof(props->'autotranslation') = 'boolean'
    );

-- Hot path index: Members opted in for a channel (missing = false)
CREATE INDEX IF NOT EXISTS idx_channelmembers_autotranslation_enabled
    ON channelmembers (channelid)
    WHERE COALESCE((props->>'autotranslation')::boolean, false) = true;
