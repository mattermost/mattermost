UPDATE PluginKeyValueStore k 
SET PluginId='playbooks' 
WHERE PluginId='com.mattermost.plugin-incident-management' 
AND NOT EXISTS ( SELECT 1 FROM PluginKeyValueStore WHERE PluginId='playbooks' AND PKey = k.PKey )
