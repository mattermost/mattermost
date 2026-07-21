-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_access_control_users_userid
    ON PluginAccessControlUsers (UserId);
