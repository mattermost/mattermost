// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestLeaveProviderDoCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	lp := LeaveProvider{}

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

	defaultChannel, err := th.App.GetChannelByName(model.DEFAULT_CHANNEL, th.BasicTeam.Id, false)
	require.Nil(t, err)

	guest := th.CreateGuest()

	th.App.AddUserToTeam(th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
	th.App.AddUserToChannel(th.BasicUser, publicChannel)
	th.App.AddUserToChannel(th.BasicUser, privateChannel)
	th.App.AddUserToTeam(th.BasicTeam.Id, guest.Id, guest.Id)
	th.App.AddUserToChannel(guest, publicChannel)
	th.App.AddUserToChannel(guest, defaultChannel)

	t.Run("Should error when no Channel ID in args", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId: th.BasicUser.Id,
			T:      func(s string, args ...interface{}) string { return s },
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "api.command_leave.fail.app_error", actual.Text)
		assert.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, actual.ResponseType)
	})

	t.Run("Should error when no Team ID in args", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: publicChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "api.command_leave.fail.app_error", actual.Text)
		assert.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, actual.ResponseType)
	})

	t.Run("Leave a public channel", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: publicChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
			TeamId:    th.BasicTeam.Id,
			SiteURL:   "http://localhost:8065",
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "", actual.Text)
		assert.Equal(t, args.SiteURL+"/"+th.BasicTeam.Name+"/channels/"+model.DEFAULT_CHANNEL, actual.GotoLocation)
		assert.Equal(t, "", actual.ResponseType)

		_, err = th.App.GetChannelMember(publicChannel.Id, th.BasicUser.Id)
		assert.NotNil(t, err)
		assert.NotNil(t, err.Id, "store.sql_channel.get_member.missing.app_error")
	})

	t.Run("Leave a private channel", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: privateChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
			TeamId:    th.BasicTeam.Id,
			SiteURL:   "http://localhost:8065",
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "", actual.Text)
	})

	t.Run("Should not leave a default channel", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: defaultChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
			TeamId:    th.BasicTeam.Id,
			SiteURL:   "http://localhost:8065",
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "api.channel.leave.default.app_error", actual.Text)
	})

	t.Run("Should allow to leave a default channel if user is guest", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    guest.Id,
			ChannelId: defaultChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
			TeamId:    th.BasicTeam.Id,
			SiteURL:   "http://localhost:8065",
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "", actual.Text)
		assert.Equal(t, args.SiteURL+"/"+th.BasicTeam.Name+"/channels/"+publicChannel.Name, actual.GotoLocation)
		assert.Equal(t, "", actual.ResponseType)

		_, err = th.App.GetChannelMember(defaultChannel.Id, guest.Id)
		assert.NotNil(t, err)
		assert.NotNil(t, err.Id, "store.sql_channel.get_member.missing.app_error")
	})

	t.Run("Should redirect to the team if is the last channel", func(t *testing.T) {
		args := &model.CommandArgs{
			UserId:    guest.Id,
			ChannelId: publicChannel.Id,
			T:         func(s string, args ...interface{}) string { return s },
			TeamId:    th.BasicTeam.Id,
			SiteURL:   "http://localhost:8065",
		}
		actual := lp.DoCommand(th.App, args, "")
		assert.Equal(t, "", actual.Text)
		assert.Equal(t, args.SiteURL+"/", actual.GotoLocation)
		assert.Equal(t, "", actual.ResponseType)

		_, err = th.App.GetChannelMember(publicChannel.Id, guest.Id)
		assert.NotNil(t, err)
		assert.NotNil(t, err.Id, "store.sql_channel.get_member.missing.app_error")
	})
}
