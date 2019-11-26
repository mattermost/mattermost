package pluginapi_test

import (
	pluginapi "github.com/lieut-data/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	client *pluginapi.Client
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API)

	return nil
}

func Example() {
}
