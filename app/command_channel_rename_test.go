// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestRenameProviderDoCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	rp := RenameProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	// Blank text is a success
	for msg, expected := range map[string]string{
		"":                        "api.command_channel_rename.message.app_error",
		"o":                       "api.command_channel_rename.too_short.app_error",
		"joram":                   "",
		"1234567890123456789012":  "",
		"12345678901234567890123": "api.command_channel_rename.too_long.app_error",
	} {
		actual := rp.DoCommand(th.App, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	// Try a public channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual := rp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_rename.permission.app_error", actual)

	// Try a private channel *with* permission.
	privateChannel := th.CreatePrivateChannel(th.BasicTeam)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = rp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_rename.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.CreateUser()
	user2 := th.CreateUser()

	groupChannel := th.CreateGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_rename.direct_group.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.CreateDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_rename.direct_group.app_error", actual)
}
