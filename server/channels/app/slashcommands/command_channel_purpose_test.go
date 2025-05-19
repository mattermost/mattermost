// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPurposeProviderDoCommand(t *testing.T) {
	th := setup(t).initBasic(t)

	pp := PurposeProvider{}

	// Try a public channel *with* permission.
	th.addPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_purpose.message.app_error",
		"hello": "",
	} {
		actual := pp.DoCommand(th.App, th.Context, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	// Try a public channel *without* permission.
	th.removePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
	}

	actual := pp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.permission.app_error", actual)

	// Try a private channel *with* permission.
	privateChannel := th.createPrivateChannel(t, th.BasicTeam)

	th.addPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = pp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	th.removePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: privateChannel.Id,
	}

	actual = pp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.createUser(t)
	user2 := th.createUser(t)

	groupChannel := th.createGroupChannel(t, user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: groupChannel.Id,
	}

	actual = pp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.direct_group.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.createDmChannel(t, user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: directChannel.Id,
	}

	actual = pp.DoCommand(th.App, th.Context, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.direct_group.app_error", actual)
}
