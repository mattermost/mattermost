// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
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

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, post *model.Post) (*model.Post, string) {
	// The test framework passes a nil post, only run tests for the nil post
	if post != nil {
		return nil, ""
	}

	// Test adding multiple users to a channel at once
	userIDs := []string{
		p.configuration.BasicUser2Id,
		p.configuration.BasicUserID,
	}

	// First test: add multiple users to a channel
	members, err := p.API.AddChannelMembers(p.configuration.BasicChannelID, userIDs)
	if err != nil {
		return nil, err.Error()
	}

	if len(members) != 2 {
		return nil, "Expected 2 channel members, got " + string('0'+rune(len(members)))
	}

	// Verify channel members were added correctly
	for idx, userID := range userIDs {
		if members[idx].UserId != userID {
			return nil, "User ID mismatch for member " + string('0'+rune(idx))
		}
		if members[idx].ChannelId != p.configuration.BasicChannelID {
			return nil, "Channel ID mismatch for member " + string('0'+rune(idx))
		}
	}

	// Second test: adding the same users again should return the existing members
	// without any errors
	members, err = p.API.AddChannelMembers(p.configuration.BasicChannelID, userIDs)
	if err != nil {
		return nil, "Error adding already existing members: " + err.Error()
	}

	if len(members) != 2 {
		return nil, "Expected 2 channel members when adding existing members, got " + string('0'+rune(len(members)))
	}

	// Third test: test with an invalid channel ID
	_, err = p.API.AddChannelMembers("invalid-channel-id", userIDs)
	if err == nil {
		return nil, "Expected error when adding members to invalid channel"
	}

	// Fourth test: test with one valid and one invalid user ID
	invalidUserIDs := []string{p.configuration.BasicUserID, "invalid-user-id"}
	members, err = p.API.AddChannelMembers(p.configuration.BasicChannelID, invalidUserIDs)
	if err == nil {
		return nil, "Expected error when adding an invalid user ID"
	}

	// Should still return the valid member
	if len(members) != 1 {
		return nil, "Expected 1 valid member when one user ID is invalid"
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
