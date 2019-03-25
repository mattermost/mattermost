// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type configuration struct {
	MyStringSetting string
	MyIntSetting    int
	MyBoolSetting   bool
}

type MyPlugin struct {
	plugin.MattermostPlugin

	configuration configuration
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}

	return nil
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	b, _ := json.Marshal(map[string]interface{}{
		"MyStringSetting": p.configuration.MyStringSetting,
		"MyIntSetting":    p.configuration.MyIntSetting,
		"MyBoolSetting":   p.configuration.MyBoolSetting,
	})

	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
