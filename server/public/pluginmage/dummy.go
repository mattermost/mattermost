package pluginmage

import "time"

// Dummy prints a hello message and plugin info
func Dummy() error {
	// The plugin info is already initialized via init() when this runs
	Logger.Debug("Debug")
	Logger.Info("Info")
	Logger.Warn("Warn")
	Logger.Error("Error")
	time.Sleep(1 * time.Second)
	Logger.Info("Plugin info",
		"id", info.Manifest.Id,
		"version", info.Manifest.Version,
		"name", info.Manifest.Name)
	return nil
}
