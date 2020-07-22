// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/v5/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
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

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	channelMembers, err := p.API.GetChannelMembersForUser(p.configuration.BasicTeamId, p.configuration.BasicUserId, 0, 10)

	if err != nil {
		return nil, err.Error() + "failed to get channel members"
	} else if len(channelMembers) != 3 {
		return nil, "Invalid number of channel members"
	} else if channelMembers[0].UserId != p.configuration.BasicUserId {
		return nil, "Invalid user id returned"
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
