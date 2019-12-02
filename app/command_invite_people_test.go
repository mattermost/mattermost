// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestInvitePeopleProvider(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	cmd := InvitePeopleProvider{}

	// Test without required permissions
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual := cmd.DoCommand(th.App, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command_invite_people.permission.app_error", actual.Text)

	// Test with required permissions.
	args.Session.TeamMembers[0].Roles = model.TEAM_USER_ROLE_ID
	actual = cmd.DoCommand(th.App, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command.invite_people.sent", actual.Text)
}
