// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestHeaderProviderDoCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	hp := HeaderProvider{}

	th.AddPermissionToRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a public channel *with* permission.
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_header.message.app_error",
		"hello": "",
	} {
		actual := hp.DoCommand(th.App, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a public channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual := hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a private channel *with* permission.
	privateChannel := th.CreatePrivateChannel(th.BasicTeam)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	user3 := th.CreateUser()

	groupChannel := th.CreateGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a group channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		Session:   model.Session{UserId: user3.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.CreateDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a direct channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		Session:   model.Session{UserId: user2.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)
}
