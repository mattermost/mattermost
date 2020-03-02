package cluster_test

import (
	"github.com/mattermost/mattermost-plugin-api/cluster"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

func ExampleMutex() {
	// Use p.API from your plugin instead.
	pluginAPI := plugin.API(nil)

	m := cluster.NewMutex(pluginAPI, "key")
	m.Lock()
	// critical section
	m.Unlock()
}
