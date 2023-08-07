package pluginapi_test

import (
	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"

	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	client *pluginapi.Client
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)

	return nil
}

func Example() {
}
