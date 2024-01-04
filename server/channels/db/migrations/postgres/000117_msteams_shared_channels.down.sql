ALTER TABLE RemoteClusters DROP COLUMN IF EXISTS PluginID;

ALTER TABLE SharedChannelRemotes DROP COLUMN IF EXISTS LastPostCreateAt;

ALTER TABLE SharedChannelRemotes DROP COLUMN IF EXISTS LastPostCreateID;

