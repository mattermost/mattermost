-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_guards_plugin_id ON ChannelGuards(PluginId);
