package plugin

import (
	"net/http"
)

type Hooks interface {
	// OnActivate is invoked when the plugin is activated.
	OnActivate(API) error

	// OnDeactivate is invoked when the plugin is deactivated. This is the plugin's last chance to
	// use the API, and the plugin will be terminated shortly after this invocation.
	OnDeactivate() error

	// OnConfigurationChange is invoked when configuration changes may have been made.
	OnConfigurationChange() error

	// ServeHTTP allows the plugin to implement the http.Handler interface. Requests destined for
	// the /plugins/{id} path will be routed to the plugin.
	//
	// The Mattermost-User-Id header will be present if (and only if) the request is by an
	// authenticated user.
	ServeHTTP(http.ResponseWriter, *http.Request)
}
