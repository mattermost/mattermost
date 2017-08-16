package pluginenv

import (
	"fmt"

	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/rpcplugin"
)

// APIProvider specifies a function that provides an API implementation to each plugin.
func APIProvider(provider APIProviderFunc) Option {
	return func(env *Environment) {
		env.apiProvider = provider
	}
}

// SupervisorProvider specifies a function that provides a Supervisor implementation to each plugin.
// If unspecified, DefaultSupervisorProvider is used.
func SupervisorProvider(provider SupervisorProviderFunc) Option {
	return func(env *Environment) {
		env.supervisorProvider = provider
	}
}

// SearchPath specifies a directory that contains the plugins to launch.
func SearchPath(path string) Option {
	return func(env *Environment) {
		env.searchPath = path
	}
}

// DefaultSupervisorProvider chooses a supervisor based on the plugin's manifest contents. E.g. if
// the manifest specifies a backend executable, it will be given an rpcplugin.Supervisor.
func DefaultSupervisorProvider(bundle *plugin.BundleInfo) (plugin.Supervisor, error) {
	if bundle.Manifest == nil {
		return nil, fmt.Errorf("a manifest is required")
	}
	if bundle.Manifest.Backend == nil {
		return nil, fmt.Errorf("invalid manifest: at this time, only backend plugins are supported")
	}
	return rpcplugin.SupervisorProvider(bundle)
}
