package plugin

type API interface {
	// Loads the plugin's configuration
	LoadPluginConfiguration(dest interface{}) error
}
