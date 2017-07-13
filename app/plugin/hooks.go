package plugin

// All implementations should be safe for concurrent use.
type Hooks interface {
	// Invoked when configuration changes may have been made
	OnConfigurationChange()
}
