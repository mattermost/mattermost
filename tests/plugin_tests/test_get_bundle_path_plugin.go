package main

import (
	"encoding/json"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	bundlePath, err := p.API.GetBundlePath()
	result := map[string]interface{}{}
	if err != nil {
		result["Error"] = err.Error() + "failed get bundle path"
	} else {
		result["BundlePath"] = bundlePath
	}

	b, _ := json.Marshal(result)
	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
