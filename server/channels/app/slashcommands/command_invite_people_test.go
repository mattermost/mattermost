// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestInvitePeopleProvider(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	cmd := InvitePeopleProvider{}

	notTeamUser := th.createUser()

	// Test without required permissions
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    notTeamUser.Id,
	}

	actual := cmd.DoCommand(th.App, th.Context, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command_invite_people.permission.app_error", actual.Text)

	// Test with required permissions.
	args.UserId = th.BasicUser.Id
	actual = cmd.DoCommand(th.App, th.Context, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command.invite_people.sent", actual.Text)
}
