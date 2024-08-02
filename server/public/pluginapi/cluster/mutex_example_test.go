package cluster_test

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
)

//nolint:staticcheck
func ExampleMutex() {
	// Use p.API from your plugin instead.
	pluginAPI := plugin.API(nil)

	m, err := cluster.NewMutex(pluginAPI, "key")
	if err != nil {
		panic(err)
	}
	m.Lock()
	// critical section
	m.Unlock()
}
