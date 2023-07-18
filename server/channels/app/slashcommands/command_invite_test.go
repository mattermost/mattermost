// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func TestInviteProvider(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	inviteProvider := InviteProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
	}

	runCmd := func(msg string, expected string) {
		actual := inviteProvider.DoCommand(th.App, th.Context, args, msg).Text
		assert.Equal(t, expected, actual)
	}

	checkIsMember := func(channelID, userID string) {
		_, channelMemberErr := th.App.GetChannelMember(th.Context, channelID, userID)
		require.Nil(t, channelMemberErr, "Failed to add user to channel")
	}

	checkIsNotMember := func(channelID, userID string) {
		_, channelMemberErr := th.App.GetChannelMember(th.Context, channelID, userID)
		require.NotNil(t, channelMemberErr, "Failed to add user to channel")
	}

	t.Run("try to add missing user and channel in the command", func(t *testing.T) {
		msg := ""
		runCmd(msg, "api.command_invite.missing_message.app_error")
	})

	t.Run("user added in the current channel", func(t *testing.T) {
		msg := th.BasicUser2.Username
		runCmd(msg, "")
		checkIsMember(th.BasicChannel.Id, th.BasicUser2.Id)
	})

	t.Run("add user to another channel not the current", func(t *testing.T) {
		channel := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)

		msg := "@" + th.BasicUser2.Username + " ~" + channel.Name + " "
		runCmd(msg, "api.command_invite.success")
		checkIsMember(channel.Id, th.BasicUser2.Id)
	})

	t.Run("add a user to a private channel", func(t *testing.T) {
		privateChannel := th.createChannel(th.BasicTeam, model.ChannelTypePrivate)

		msg := "@" + th.BasicUser2.Username + " ~" + privateChannel.Name
		runCmd(msg, "api.command_invite.success")
		checkIsMember(privateChannel.Id, th.BasicUser2.Id)
	})

	t.Run("add multiple users to multiple channels", func(t *testing.T) {
		anotherUser := th.createUser()
		th.linkUserToTeam(anotherUser, th.BasicTeam)
		channel1 := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)
		channel2 := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)

		msg := "@" + th.BasicUser2.Username + " @" + anotherUser.Username + " ~" + channel1.Name + " ~" + channel2.Name
		expected := "api.command_invite.success\napi.command_invite.success\napi.command_invite.success\napi.command_invite.success"
		runCmd(msg, expected)
		checkIsMember(channel1.Id, th.BasicUser2.Id)
		checkIsMember(channel2.Id, th.BasicUser2.Id)
		checkIsMember(channel1.Id, anotherUser.Id)
		checkIsMember(channel2.Id, anotherUser.Id)
	})

	t.Run("adds multiple users even when some are invalid or already members", func(t *testing.T) {
		channel := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)
		userAlreadyInChannel := th.createUser()
		th.linkUserToTeam(userAlreadyInChannel, th.BasicTeam)
		th.addUserToChannel(userAlreadyInChannel, channel)
		userInTeam := th.createUser()
		th.linkUserToTeam(userInTeam, th.BasicTeam)
		userNotInTeam := th.createUser()

		msg := "@invalidUser123 @" + userAlreadyInChannel.Username + " @" + userInTeam.Username + " @" + userNotInTeam.Username + " ~" + channel.Name
		expected := "api.command_invite.missing_user.app_error\n"
		expected += "api.command_invite.user_already_in_channel.app_error\n"
		expected += "api.command_invite.success\n"
		expected += "api.command_invite.user_not_in_team.app_error"
		runCmd(msg, expected)
		checkIsMember(channel.Id, userInTeam.Id)
	})

	t.Run("try to add a user to a direct channel", func(t *testing.T) {
		anotherUser := th.createUser()
		th.linkUserToTeam(anotherUser, th.BasicTeam)
		directChannel := th.createDmChannel(th.BasicUser2)

		msg := "@" + anotherUser.Username + " ~" + directChannel.Name
		runCmd(msg, "api.command_invite.directchannel.app_error")
		checkIsNotMember(directChannel.Id, anotherUser.Id)
	})

	t.Run("try to add a user to an invalid channel", func(t *testing.T) {
		msg := "@" + th.BasicUser2.Username + " wrongchannel1"
		runCmd(msg, "api.command_invite.channel.error")
	})

	t.Run("try to add a user using channel's display name", func(t *testing.T) {
		channel := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)

		msg := "@" + th.BasicUser2.Username + " ~" + channel.DisplayName
		runCmd(msg, "api.command_invite.channel.error")
		checkIsNotMember(channel.Id, th.BasicUser2.Id)
	})

	t.Run("try add invalid user to current channel", func(t *testing.T) {
		msg := "@invalidUser123"
		runCmd(msg, "api.command_invite.missing_user.app_error")
	})

	t.Run("invalid user to current channel without @", func(t *testing.T) {
		msg := "invalidUser123"
		runCmd(msg, "api.command_invite.missing_user.app_error")
	})

	t.Run("try to add a user which is not part of the team", func(t *testing.T) {
		anotherUser := th.createUser()
		// Do not add user to the team

		msg := anotherUser.Username
		runCmd(msg, "api.command_invite.user_not_in_team.app_error")
	})

	t.Run("try to add a user not part of the group to a group channel", func(t *testing.T) {
		groupChannel := th.createChannel(th.BasicTeam, model.ChannelTypePrivate)
		_, err := th.App.AddChannelMember(th.Context, th.BasicUser.Id, groupChannel, app.ChannelMemberOpts{})
		require.Nil(t, err)
		groupChannel.GroupConstrained = model.NewBool(true)
		groupChannel, _ = th.App.UpdateChannel(th.Context, groupChannel)

		msg := "@" + th.BasicUser2.Username + " ~" + groupChannel.Name
		runCmd(msg, "api.command_invite.group_constrained_user_denied")
		checkIsNotMember(groupChannel.Id, th.BasicUser2.Id)
	})

	t.Run("try to add a user to a private channel with no permission", func(t *testing.T) {
		anotherUser := th.createUser()
		th.linkUserToTeam(anotherUser, th.BasicTeam)
		privateChannel := th.createChannelWithAnotherUser(th.BasicTeam, model.ChannelTypePrivate, th.BasicUser2.Id)

		msg := "@" + anotherUser.Username + " ~" + privateChannel.Name
		runCmd(msg, "api.command_invite.private_channel.app_error")
		checkIsNotMember(privateChannel.Id, anotherUser.Id)
	})

	t.Run("try to add a deleted user to a public channel", func(t *testing.T) {
		channel := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)
		deactivatedUser := th.createUser()
		_, appErr := th.App.UpdateActive(th.Context, deactivatedUser, false)
		require.Nil(t, appErr)

		msg := "@" + deactivatedUser.Username + " ~" + channel.Name
		runCmd(msg, "api.command_invite.missing_user.app_error")
		checkIsNotMember(channel.Id, deactivatedUser.Id)
	})

	t.Run("add bot to a public channel", func(t *testing.T) {
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{Username: "bot_" + model.NewId(), OwnerId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot.UserId, th.BasicUser2.Id)
		require.Nil(t, appErr)

		msg := "@" + bot.Username
		runCmd(msg, "")
		checkIsMember(th.BasicChannel.Id, bot.UserId)
	})

	t.Run("try to add bot to a public channel without being a member", func(t *testing.T) {
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{Username: "bot_" + model.NewId(), OwnerId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		// Do not add to the team

		msg := "@" + bot.Username
		runCmd(msg, "api.command_invite.user_not_in_team.app_error")
		checkIsNotMember(th.BasicChannel.Id, bot.UserId)
	})

	t.Run("try to add bot removed from a team to a public channel", func(t *testing.T) {
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{Username: "bot_" + model.NewId(), OwnerId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot.UserId, th.BasicUser2.Id)
		require.Nil(t, appErr)
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, bot.UserId, th.BasicUser2.Id)
		require.Nil(t, appErr)

		msg := "@" + bot.Username
		runCmd(msg, "api.command_invite.user_not_in_team.app_error")
		checkIsNotMember(th.BasicChannel.Id, bot.UserId)
	})
}

func TestInviteGroup(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	th.BasicTeam.GroupConstrained = model.NewBool(true)
	var err *model.AppError
	_, _ = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, th.BasicUser.Id)
	_, err = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	th.BasicTeam, _ = th.App.UpdateTeam(th.BasicTeam)

	privateChannel := th.createChannel(th.BasicTeam, model.ChannelTypePrivate)

	groupChannelUser1 := "@" + th.BasicUser.Username + " ~" + privateChannel.Name
	groupChannelUser2 := "@" + th.BasicUser2.Username + " ~" + privateChannel.Name
	basicUser3 := th.createUser()
	groupChannelUser3 := "@" + basicUser3.Username + " ~" + privateChannel.Name

	InviteP := InviteProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
	}

	tests := []struct {
		desc     string
		expected string
		msg      string
	}{
		{
			desc:     "try to add an existing user part of the group to a group channel",
			expected: "api.command_invite.user_already_in_channel.app_error",
			msg:      groupChannelUser1,
		},
		{
			desc:     "try to add a user part of the group to a group channel",
			expected: "api.command_invite.success",
			msg:      groupChannelUser2,
		},
		{
			desc:     "try to add a user NOT part of the group to a group channel",
			expected: "api.command_invite.user_not_in_team.app_error",
			msg:      groupChannelUser3,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			actual := InviteP.DoCommand(th.App, th.Context, args, test.msg).Text
			assert.Equal(t, test.expected, actual)
		})
	}
}
