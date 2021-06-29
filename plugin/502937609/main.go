
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/model"
			"github.com/mattermost/mattermost-server/v5/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			panic("Uncaught error")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	