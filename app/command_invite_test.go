// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestInviteProvider(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	channel := th.createChannel(th.BasicTeam, model.CHANNEL_OPEN)
	privateChannel := th.createChannel(th.BasicTeam, model.CHANNEL_PRIVATE)
	dmChannel := th.CreateDmChannel(th.BasicUser2)
	privateChannel2 := th.createChannelWithAnotherUser(th.BasicTeam, model.CHANNEL_PRIVATE, th.BasicUser2.Id)

	basicUser3 := th.CreateUser()
	th.LinkUserToTeam(basicUser3, th.BasicTeam)
	basicUser4 := th.CreateUser()
	deactivatedUser := th.CreateUser()
	th.App.UpdateActive(deactivatedUser, false)

	InviteP := InviteProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	userAndWrongChannel := "@" + th.BasicUser2.Username + " wrongchannel1"
	userAndChannel := "@" + th.BasicUser2.Username + " ~" + channel.Name + " "
	userAndDisplayChannel := "@" + th.BasicUser2.Username + " ~" + channel.DisplayName + " "
	userAndPrivateChannel := "@" + th.BasicUser2.Username + " ~" + privateChannel.Name
	userAndDMChannel := "@" + basicUser3.Username + " ~" + dmChannel.Name
	userAndInvalidPrivate := "@" + basicUser3.Username + " ~" + privateChannel2.Name
	deactivatedUserPublicChannel := "@" + deactivatedUser.Username + " ~" + channel.Name

	tests := []struct {
		desc     string
		expected string
		msg      string
	}{
		{
			desc:     "Missing user and channel in the command",
			expected: "api.command_invite.missing_message.app_error",
			msg:      "",
		},
		{
			desc:     "User added in the current channel",
			expected: "",
			msg:      th.BasicUser2.Username,
		},
		{
			desc:     "Add user to another channel not the current",
			expected: "api.command_invite.success",
			msg:      userAndChannel,
		},
		{
			desc:     "try to add a user to a direct channel",
			expected: "api.command_invite.directchannel.app_error",
			msg:      userAndDMChannel,
		},
		{
			desc:     "Try to add a user to a invalid channel",
			expected: "api.command_invite.channel.error",
			msg:      userAndWrongChannel,
		},
		{
			desc:     "Try to add a user to an private channel",
			expected: "api.command_invite.success",
			msg:      userAndPrivateChannel,
		},
		{
			desc:     "Using display channel name which is different form Channel name",
			expected: "api.command_invite.channel.error",
			msg:      userAndDisplayChannel,
		},
		{
			desc:     "Invalid user to current channel",
			expected: "api.command_invite.missing_user.app_error",
			msg:      "@invalidUser123",
		},
		{
			desc:     "Invalid user to current channel without @",
			expected: "api.command_invite.missing_user.app_error",
			msg:      "invalidUser321",
		},
		{
			desc:     "try to add a user which is not part of the team",
			expected: "api.command_invite.fail.app_error",
			msg:      basicUser4.Username,
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
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			actual := InviteP.DoCommand(th.App, args, test.msg).Text
			assert.Equal(t, test.expected, actual)
		})
	}
}
