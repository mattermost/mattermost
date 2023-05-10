// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestRemoveProviderDoCommand(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	rp := RemoveProvider{}

	publicChannel, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	privateChannel, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	targetUser := th.createUser()
	th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, targetUser.Id, targetUser.Id)
	th.App.AddUserToChannel(th.Context, targetUser, publicChannel, false)
	th.App.AddUserToChannel(th.Context, targetUser, privateChannel, false)

	// Try a public channel *without* permission.
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: publicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual := rp.DoCommand(th.App, th.Context, args, targetUser.Username).Text
	assert.Equal(t, "api.command_remove.permission.app_error", actual)

	// Try a public channel *with* permission.
	th.App.AddUserToChannel(th.Context, th.BasicUser, publicChannel, false)
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: publicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, targetUser.Username).Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, targetUser.Username).Text
	assert.Equal(t, "api.command_remove.permission.app_error", actual)

	// Try a private channel *with* permission.
	th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, targetUser.Username).Text
	assert.Equal(t, "", actual)

	// Try a group channel
	user1 := th.createUser()
	user2 := th.createUser()

	groupChannel := th.createGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: groupChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, user1.Username).Text
	assert.Equal(t, "api.command_remove.direct_group.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.createDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: directChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, user1.Username).Text
	assert.Equal(t, "api.command_remove.direct_group.app_error", actual)

	// Try a public channel with a deactivated user.
	deactivatedUser := th.createUser()
	th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, deactivatedUser.Id, deactivatedUser.Id)
	th.App.AddUserToChannel(th.Context, deactivatedUser, publicChannel, false)
	th.App.UpdateActive(th.Context, deactivatedUser, false)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: publicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = rp.DoCommand(th.App, th.Context, args, deactivatedUser.Username).Text
	assert.Equal(t, "api.command_remove.missing.app_error", actual)
}
