DROP INDEX IF EXISTS idx_channels_defaultcategoryname ON channels;
ALTER TABLE channels DROP COLUMN IF EXISTS DefaultCategoryName; 