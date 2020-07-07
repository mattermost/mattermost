// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestPurposeProviderDoCommand(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	pp := PurposeProvider{}

	// Try a public channel *with* permission.
	th.addPermissionToRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_purpose.message.app_error",
		"hello": "",
	} {
		actual := pp.DoCommand(th.App, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	// Try a public channel *without* permission.
	th.removePermissionFromRole(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
	}

	actual := pp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.permission.app_error", actual)

	// Try a private channel *with* permission.
	privateChannel := th.createPrivateChannel(th.BasicTeam)

	th.addPermissionToRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	actual = pp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	th.removePermissionFromRole(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id, model.CHANNEL_USER_ROLE_ID)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: privateChannel.Id,
	}

	actual = pp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.permission.app_error", actual)

	// Try a group channel *with* being a member.
	user1 := th.createUser()
	user2 := th.createUser()

	groupChannel := th.createGroupChannel(user1, user2)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: groupChannel.Id,
	}

	actual = pp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.direct_group.app_error", actual)

	// Try a direct channel *with* being a member.
	directChannel := th.createDmChannel(user1)

	args = &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: directChannel.Id,
	}

	actual = pp.DoCommand(th.App, args, "hello").Text
	assert.Equal(t, "api.command_channel_purpose.direct_group.app_error", actual)
}
