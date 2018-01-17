// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pluginenv

import (
	"fmt"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
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

// WebappPath specifies the static directory serving the webapp.
func WebappPath(path string) Option {
	return func(env *Environment) {
		env.webappPath = path
	}
}

// DefaultSupervisorProvider chooses a supervisor based on the plugin's manifest contents. E.g. if
// the manifest specifies a backend executable, it will be given an rpcplugin.Supervisor.
func DefaultSupervisorProvider(bundle *model.BundleInfo) (plugin.Supervisor, error) {
	if bundle.Manifest == nil {
		return nil, fmt.Errorf("a manifest is required")
	}
	if bundle.Manifest.Backend == nil {
		return nil, fmt.Errorf("invalid manifest: missing backend plugin")
	}
	return rpcplugin.SupervisorProvider(bundle)
}
