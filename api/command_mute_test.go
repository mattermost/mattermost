// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/nicksnyder/go-i18n/i18n"
)

func TestMuteCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	i18n.MustLoadTranslationFile("../i18n/en.json")
	T, _ := i18n.Tfunc("en")

	// Create client and users
	Client := th.BasicClient
	team := th.BasicTeam
	user1 := Client.Must(Client.GetMe("")).Data.(*model.User)
	user2 := th.BasicUser2

	// Mute channel1 directly with '/mute'
	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)
	Client.Must(Client.JoinChannel(channel1.Id))

	channel1M := Client.Must(Client.GetChannelMember(channel1.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel1M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted on initial setup")
	}

	rs := Client.Must(Client.Command(channel1.Id, "/mute")).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_mute", map[string]interface{}{"Channel": channel1.DisplayName})) {
		t.Fatal("failed to mute channel")
	}

	channel1M = Client.Must(Client.GetChannelMember(channel1.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel1M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_NONE {
		t.Fatal("channel should be muted")
	}

	rs = Client.Must(Client.Command(channel1.Id, "/mute")).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel1.DisplayName})) {
		t.Fatal("failed to mute channel")
	}

	channel1M = Client.Must(Client.GetChannelMember(channel1.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel1M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted anymore")
	}

	// Mute channel2 via channel1 with chan-handle '/mute ~aa'
	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	Client.Must(Client.JoinChannel(channel2.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, user2.Id))

	channel2M := Client.Must(Client.GetChannelMember(channel2.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel2M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted on initial setup")
	}

	rs = Client.Must(Client.Command(channel1.Id, "/mute ~" + channel2.Name)).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_mute", map[string]interface{}{"Channel": channel2.DisplayName})) {
		t.Fatal("failed to mute channel")
	}

	channel2M = Client.Must(Client.GetChannelMember(channel2.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel2M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_NONE {
		t.Fatal("channel should be muted")
	}

	rs = Client.Must(Client.Command(channel1.Id, "/mute ~" + channel2.Name)).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel2.DisplayName})) {
		t.Fatal("failed to mute channel")
	}

	channel2M = Client.Must(Client.GetChannelMember(channel2.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel2M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted anymore")
	}

	// Mute direct message
	channel3 := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)
	channel3M := Client.Must(Client.GetChannelMember(channel3.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel3M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted on initial setup")
	}

	rs = Client.Must(Client.Command(channel3.Id, "/mute")).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_mute_direct_msg")) {
		t.Fatal("failed to mute channel")
	}

	channel3M = Client.Must(Client.GetChannelMember(channel3.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel3M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_NONE {
		t.Fatal("channel should be muted")
	}

	rs = Client.Must(Client.Command(channel3.Id, "/mute")).Data.(*model.CommandResponse)
	if !strings.EqualFold(rs.Text, T("api.command_mute.success_unmute_direct_msg")) {
		t.Fatal("failed to mute channel")
	}

	channel3M = Client.Must(Client.GetChannelMember(channel3.Id, user1.Id)).Data.(*model.ChannelMember)
	if channel3M.NotifyProps[model.MUTE_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MUTE_ALL {
		t.Fatal("channel shouldn't be muted anymore")
	}
}
