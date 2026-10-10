UPDATE PluginKeyValueStore k 
SET PluginId='com.mattermost.plugin-incident-management' 
WHERE PluginId='playbooks' 
AND NOT EXISTS ( SELECT 1 FROM PluginKeyValueStore WHERE PluginId='com.mattermost.plugin-incident-management' AND PKey = k.PKey )   
