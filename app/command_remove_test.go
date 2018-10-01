// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestRemoveProviderDoCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	rp := RemoveProvider{}

	publicChannel, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	privateChannel, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	targetUser := th.CreateUser()
	th.App.AddUserToTeam(th.BasicTeam.Id, targetUser.Id, targetUser.Id)
	th.App.AddUserToChannel(targetUser, publicChannel)
	th.App.AddUserToChannel(targetUser, privateChannel)

	// Try a public channel *without* permission.
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: publicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual := rp.DoCommand(th.App, args, targetUser.Username).Text
	assert.Equal(t, "api.command_remove.permission.app_error", actual)

	// Try a public channel *with* permission.
	th.App.AddUserToChannel(th.BasicUser, publicChannel)
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: publicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, targetUser.Username).Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, targetUser.Username).Text
	assert.Equal(t, "api.command_remove.permission.app_error", actual)

	// Try a private channel *with* permission.
	th.App.AddUserToChannel(th.BasicUser, privateChannel)
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, targetUser.Username).Text
	assert.Equal(t, "", actual)

	// Try a group channel
	user1 := th.CreateUser()
	user2 := th.CreateUser()

	groupChannel := th.CreateGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, user1.Username).Text
	assert.Equal(t, "api.command_remove.direct_group.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.CreateDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, user1.Username).Text
	assert.Equal(t, "api.command_remove.direct_group.app_error", actual)

	// Try a public channel with a deactivated user.
	deactivatedUser := th.CreateUser()
	th.App.AddUserToTeam(th.BasicTeam.Id, deactivatedUser.Id, deactivatedUser.Id)
	th.App.AddUserToChannel(deactivatedUser, publicChannel)
	th.App.UpdateActive(deactivatedUser, false)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: publicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual = rp.DoCommand(th.App, args, deactivatedUser.Username).Text
	assert.Equal(t, "api.command_remove.missing.app_error", actual)
}
