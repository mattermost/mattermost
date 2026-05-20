// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
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
	// Test API.LoadPluginConfiguration
	if p.configuration.MyStringSetting != "str" {
		return nil, "MyStringSetting has invalid value"
	}
	if p.configuration.MyIntSetting != 32 {
		return nil, fmt.Sprintf("MyIntSetting has invalid value %v != %v", p.configuration.MyIntSetting, 32)
	}
	if !p.configuration.MyBoolSetting {
		return nil, "MyBoolSetting has invalid value"
	}

	// Test API.GetPluginConfig
	pc := p.API.GetPluginConfig()
	if pc == nil {
		return nil, "GetPluginConfig returned nil"
	}
	if pc["mystringsetting"] != "str" {
		return nil, fmt.Sprintf("MyStringSetting has invalid value: %v", pc["mystringsetting"])
	}
	if pc["MyIntSetting"] != float64(32) {
		return nil, fmt.Sprintf("MyIntSetting has invalid value: %v", pc["MyIntSetting"])
	}
	if pc["myBoolsetting"] != true {
		return nil, fmt.Sprintf("MyBoolSetting has invalid value: %v", pc["myBoolsetting"])
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
