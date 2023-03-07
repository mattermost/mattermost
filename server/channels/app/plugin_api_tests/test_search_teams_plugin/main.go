// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	teams, err := p.API.SearchTeams(p.configuration.BasicTeamName)
	if err != nil {
		return nil, "search failed: " + err.Message
	}
	if len(teams) != 1 {
		return nil, fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
	}

	teams, err = p.API.SearchTeams(p.configuration.BasicTeamDisplayName)
	if err != nil {
		return nil, "search failed: " + err.Message
	}
	if len(teams) != 1 {
		return nil, fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
	}

	teams, err = p.API.SearchTeams(p.configuration.BasicTeamName[:3])

	if err != nil {
		return nil, "search failed: " + err.Message
	}
	if len(teams) != 1 {
		return nil, fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
	}

	teams, err = p.API.SearchTeams("not found")
	if err != nil {
		return nil, "search failed: " + err.Message
	}
	if len(teams) != 0 {
		return nil, fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
	}
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
