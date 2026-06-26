// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"context"

	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// HookLogin implements the logic performed by Playbooks right after the user
// has logged in.
func (c *SimulController) HookLogin(u ltuser.User) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Get and store settings
	settings, err := pbClient.Settings.Get(ctx)
	if err != nil {
		return nil
	}
	c.store.SetSettings(settings)

	// Connect the bot
	return pbClient.Bot.Connect(ctx)
}

// HookSwitchTeam implements the logic performed by Playbooks right after the
// user has switched to another team.
func (c *SimulController) HookSwitchTeam(u ltuser.User, teamID string) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	runs, err := gqlRunsOnTeam(pbClient, teamID)
	if err != nil {
		return err
	}

	return c.store.SetRunsOnTeam(runs)
}

// HookSwitchChannel implements the logic performed by Playbooks right after the
// user has switched to another channel.
func (c *SimulController) HookSwitchChannel(u ltuser.User, channelID string) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	actions, err := pbClient.Actions.List(context.Background(), channelID, client.ChannelActionListOptions{
		TriggerType: client.TriggerTypeNewMemberJoins,
	})
	if err != nil {
		return err
	}

	return c.store.SetActions(channelID, actions)
}
