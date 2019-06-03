// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

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
	if p.configuration.MyStringSetting != "str" {
		return nil, "MyStringSetting has invalid value"
	}
	if p.configuration.MyIntSetting != 32 {
		return nil, fmt.Sprintf("MyIntSetting has invalid value %v != %v", p.configuration.MyIntSetting, 32)
	}
	if p.configuration.MyBoolSetting != true {
		return nil, "MyBoolSetting has invalid value"
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
