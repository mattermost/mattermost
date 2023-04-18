// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
)

func TestMuteCommandNoChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel
	channel1M, channel1MError := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)

	assert.Nil(t, channel1MError, "User is not a member of channel 1")
	assert.NotEqual(
		t,
		channel1M.NotifyProps[model.MarkUnreadNotifyProp],
		model.ChannelNotifyMention,
		"Channel shouldn't be muted on initial setup",
	)

	cmd := &MuteProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.no_channel.error", resp.Text)
}

func TestMuteCommandNoArgs(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	channel1 := th.BasicChannel
	channel1M, _ := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)

	assert.Equal(t, model.ChannelNotifyAll, channel1M.NotifyProps[model.MarkUnreadNotifyProp])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.success_mute", resp.Text)

	// Now unmute the channel
	time.Sleep(time.Millisecond)
	resp = cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "")

	assert.Equal(t, "api.command_mute.success_unmute", resp.Text)
}

func TestMuteCommandSpecificChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel
	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, true)

	channel2M, _ := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)

	assert.Equal(t, model.ChannelNotifyAll, channel2M.NotifyProps[model.MarkUnreadNotifyProp])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, channel2.Name)
	assert.Equal(t, "api.command_mute.success_mute", resp.Text)
	channel2M, _ = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.ChannelNotifyMention, channel2M.NotifyProps[model.MarkUnreadNotifyProp])

	// Now unmute the channel
	resp = cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "~"+channel2.Name)

	assert.Equal(t, "api.command_mute.success_unmute", resp.Text)
	channel2M, _ = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.ChannelNotifyAll, channel2M.NotifyProps[model.MarkUnreadNotifyProp])
}

func TestMuteCommandNotMember(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel
	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, channel2.Name)
	assert.Equal(t, "api.command_mute.not_member.error", resp.Text)
}

func TestMuteCommandNotChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "~noexists")
	assert.Equal(t, "api.command_mute.error", resp.Text)
}

func TestMuteCommandDMChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	channel2M, _ := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)

	assert.Equal(t, model.ChannelNotifyAll, channel2M.NotifyProps[model.MarkUnreadNotifyProp])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.success_mute_direct_msg", resp.Text)
	time.Sleep(time.Millisecond)
	channel2M, _ = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.ChannelNotifyMention, channel2M.NotifyProps[model.MarkUnreadNotifyProp])

	// Now unmute the channel
	resp = cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
	}, "")

	assert.Equal(t, "api.command_mute.success_unmute_direct_msg", resp.Text)
	time.Sleep(time.Millisecond)
	channel2M, _ = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.ChannelNotifyAll, channel2M.NotifyProps[model.MarkUnreadNotifyProp])
}
