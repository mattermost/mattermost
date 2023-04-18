// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

type configuration struct {
	plugin_api_tests.BasicConfig
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

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	if p.configuration.MyStringSetting != "override" {
		return nil, "MyStringSetting has invalid value"
	}
	if p.configuration.MyIntSetting != 35 {
		return nil, "MyIntSetting has invalid value"
	}
	if !p.configuration.MyBoolSetting {
		return nil, "MyBoolSetting has invalid value"
	}
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
