package plugin

type Hooks interface {
	// OnActivate is invoked when the plugin is activated.
	OnActivate(API) error

	// OnDeactivate is invoked when the plugin is deactivated. This is the plugin's last chance to
	// use the API, and the plugin will be terminated shortly after this invocation.
	OnDeactivate() error
}
