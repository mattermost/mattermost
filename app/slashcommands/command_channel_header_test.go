// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestHeaderProviderDoCommand(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	hp := HeaderProvider{}

	th.addPermissionToRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a public channel *with* permission.
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_header.message.app_error",
		"hello": "",
	} {
		actual := hp.DoCommand(th.App, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	th.removePermissionFromRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a public channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual := hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	th.addPermissionToRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a private channel *with* permission.
	privateChannel := th.createPrivateChannel(th.BasicTeam)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	th.removePermissionFromRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	// Try a private channel *without* permission.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.createUser()
	user2 := th.createUser()
	user3 := th.createUser()

	groupChannel := th.createGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		UserId:    user1.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a group channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
		UserId:    user3.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.createDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a direct channel *without* being a member.
	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
		UserId:    user2.Id,
	}

	actual = hp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_header.permission.app_error", actual)
}
