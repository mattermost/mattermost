ALTER TABLE channels ADD COLUMN IF NOT EXISTS DefaultCategoryName varchar(64);
CREATE INDEX IF NOT EXISTS idx_channels_defaultcategoryname ON channels (DefaultCategoryName); 