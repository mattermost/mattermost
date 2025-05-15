DROP INDEX IF EXISTS idx_channels_defaultcategoryname;
ALTER TABLE channels DROP COLUMN IF EXISTS DefaultCategoryName; 