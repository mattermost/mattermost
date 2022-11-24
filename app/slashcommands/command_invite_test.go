// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

func TestInviteProvider(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	channel := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)
	privateChannel := th.createChannel(th.BasicTeam, model.ChannelTypePrivate)
	dmChannel := th.createDmChannel(th.BasicUser2)
	privateChannel2 := th.createChannelWithAnotherUser(th.BasicTeam, model.ChannelTypePrivate, th.BasicUser2.Id)
	channel2 := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)
	channel3 := th.createChannel(th.BasicTeam, model.ChannelTypeOpen)

	basicUser3 := th.createUser()
	th.linkUserToTeam(basicUser3, th.BasicTeam)
	basicUser4 := th.createUser()
	deactivatedUser := th.createUser()
	th.App.UpdateActive(th.Context, deactivatedUser, false)

	var err *model.AppError
	bot1, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "bot1",
		OwnerId:     basicUser3.Id,
		Description: "a test bot",
	})
	require.Nil(t, err)

	bot2, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "bot2",
		OwnerId:     basicUser3.Id,
		Description: "a test bot",
	})
	require.Nil(t, err)
	_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot2.UserId, basicUser3.Id)
	require.Nil(t, err)

	bot3, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "bot3",
		OwnerId:     basicUser3.Id,
		Description: "a test bot",
	})
	require.Nil(t, err)
	_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot3.UserId, basicUser3.Id)
	require.Nil(t, err)
	err = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, bot3.UserId, basicUser3.Id)
	require.Nil(t, err)

	InviteP := InviteProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
	}

	userAndWrongChannel := "@" + th.BasicUser2.Username + " wrongchannel1"
	userAndChannel := "@" + th.BasicUser2.Username + " ~" + channel.Name + " "
	multipleUsersAndChannels := "@" + th.BasicUser2.Username + " @" + basicUser3.Username + " ~" + channel2.Name + " ~" + channel3.Name
	userAndDisplayChannel := "@" + th.BasicUser2.Username + " ~" + channel.DisplayName + " "
	userAndPrivateChannel := "@" + th.BasicUser2.Username + " ~" + privateChannel.Name
	userAndDMChannel := "@" + basicUser3.Username + " ~" + dmChannel.Name
	userAndInvalidPrivate := "@" + basicUser3.Username + " ~" + privateChannel2.Name
	deactivatedUserPublicChannel := "@" + deactivatedUser.Username + " ~" + channel.Name

	groupChannel := th.createChannel(th.BasicTeam, model.ChannelTypePrivate)
	_, err = th.App.AddChannelMember(th.Context, th.BasicUser.Id, groupChannel, app.ChannelMemberOpts{})
	require.Nil(t, err)
	groupChannel.GroupConstrained = model.NewBool(true)
	groupChannel, _ = th.App.UpdateChannel(th.Context, groupChannel)

	groupChannelNonUser := "@" + th.BasicUser2.Username + " ~" + groupChannel.Name

	type check struct {
		userId    string
		channelId string
	}

	tests := []struct {
		desc        string
		expected    string
		msg         string
		isMember    []check
		isNotMember []check
	}{
		{
			desc:     "missing user and channel in the command",
			expected: "api.command_invite.missing_message.app_error",
			msg:      "",
		},
		{
			desc:     "user added in the current channel",
			expected: "",
			msg:      th.BasicUser2.Username,
			isMember: []check{{th.BasicUser2.Id, th.BasicChannel.Id}},
		},
		{
			desc:     "add user to another channel not the current",
			expected: "api.command_invite.success",
			msg:      userAndChannel,
			isMember: []check{{th.BasicUser2.Id, channel.Id}},
		},
		{
			desc: "add multiple users to multiple channels",
			expected: "api.command_invite.success",
			msg: multipleUsersAndChannels,
			isMember: []check{
				{th.BasicUser2.Id, channel2.Id},
				{th.BasicUser2.Id, channel3.Id},
				{basicUser3.Id, channel2.Id},
				{basicUser3.Id, channel3.Id},
			},
		},
		{
			desc:     "try to add a user to a direct channel",
			expected: "api.command_invite.directchannel.app_error",
			msg:      userAndDMChannel,
		},
		{
			desc:     "try to add a user to an invalid channel",
			expected: "api.command_invite.channel.error",
			msg:      userAndWrongChannel,
		},
		{
			desc:     "try to add a user to a private channel",
			expected: "api.command_invite.success",
			msg:      userAndPrivateChannel,
		},
		{
			desc:     "using display channel name which is different from channel name",
			expected: "api.command_invite.channel.error",
			msg:      userAndDisplayChannel,
		},
		{
			desc:     "invalid user to current channel",
			expected: "api.command_invite.missing_user.app_error",
			msg:      "@invalidUser123",
		},
		{
			desc:     "invalid user to current channel without @",
			expected: "api.command_invite.missing_user.app_error",
			msg:      "invalidUser321",
		},
		{
			desc:     "try to add a user which is not part of the team",
			expected: "api.command_invite.user_not_in_team.app_error",
			msg:      basicUser4.Username,
		},
		{
			desc:     "try to add a user not part of the group to a group channel",
			expected: "api.command_invite.group_constrained_user_denied",
			msg:      groupChannelNonUser,
		},
		{
			desc:     "try to add a user to a private channel with no permission",
			expected: "api.command_invite.private_channel.app_error",
			msg:      userAndInvalidPrivate,
		},
		{
			desc:     "try to add a deleted user to a public channel",
			expected: "api.command_invite.missing_user.app_error",
			msg:      deactivatedUserPublicChannel,
		},
		{
			desc:     "try to add bot to a public channel",
			expected: "api.command_invite.user_not_in_team.app_error",
			msg:      "@bot1",
			isNotMember: []check{{bot1.UserId, th.BasicChannel.Id}},
		},
		{
			desc:     "add bot to a public channel",
			expected: "",
			msg:      "@bot2",
			isMember: []check{{bot2.UserId, th.BasicChannel.Id}},
		},
		{
			desc:     "try to add bot removed from a team to a public channel",
			expected: "api.command_invite.user_not_in_team.app_error",
			msg:      "@bot3",
			isNotMember: []check{{bot3.UserId, th.BasicChannel.Id}},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			actual := InviteP.DoCommand(th.App, th.Context, args, test.msg).Text
			assert.Equal(t, test.expected, actual)
			if test.isMember != nil {
				for _, c := range test.isMember {
					_, channelMemberErr := th.App.GetChannelMember(th.Context, c.channelId, c.userId)
					require.Nil(t, channelMemberErr, "Failed to add user to channel")
				}
			}
			if test.isNotMember != nil {
				for _, c := range test.isMember {
					_, channelMemberErr := th.App.GetChannelMember(th.Context, c.channelId, c.userId)
					require.NotNil(t, channelMemberErr, "Should not have added user to channel")
				}
			}
		})
	}
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
