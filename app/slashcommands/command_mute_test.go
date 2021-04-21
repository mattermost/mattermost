// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

func TestMuteCommandNoChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel
	channel1M, channel1MError := th.App.GetChannelMember(context.Background(), channel1.Id, th.BasicUser.Id)

	assert.Nil(t, channel1MError, "User is not a member of channel 1")
	assert.NotEqual(
		t,
		channel1M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP],
		model.CHANNEL_NOTIFY_MENTION,
		"Channel shouldn't be muted on initial setup",
	)

	cmd := &MuteProvider{}
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.no_channel.error", resp.Text)
}

func TestMuteCommandNoArgs(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	channel1 := th.BasicChannel
	channel1M, _ := th.App.GetChannelMember(context.Background(), channel1.Id, th.BasicUser.Id)

	assert.Equal(t, model.CHANNEL_NOTIFY_ALL, channel1M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.success_mute", resp.Text)

	// Now unmute the channel
	time.Sleep(time.Millisecond)
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
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
	channel2, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, true)

	channel2M, _ := th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)

	assert.Equal(t, model.CHANNEL_NOTIFY_ALL, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, channel2.Name)
	assert.Equal(t, "api.command_mute.success_mute", resp.Text)
	channel2M, _ = th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.CHANNEL_NOTIFY_MENTION, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	// Now unmute the channel
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel1.Id,
		UserId:    th.BasicUser.Id,
	}, "~"+channel2.Name)

	assert.Equal(t, "api.command_mute.success_unmute", resp.Text)
	channel2M, _ = th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.CHANNEL_NOTIFY_ALL, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])
}

func TestMuteCommandNotMember(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel1 := th.BasicChannel
	channel2, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
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
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
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

	channel2, _ := th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	channel2M, _ := th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)

	assert.Equal(t, model.CHANNEL_NOTIFY_ALL, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	cmd := &MuteProvider{}

	// First mute the channel
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
	}, "")
	assert.Equal(t, "api.command_mute.success_mute_direct_msg", resp.Text)
	time.Sleep(time.Millisecond)
	channel2M, _ = th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.CHANNEL_NOTIFY_MENTION, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	// Now unmute the channel
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:         i18n.IdentityTfunc(),
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
	}, "")

	assert.Equal(t, "api.command_mute.success_unmute_direct_msg", resp.Text)
	time.Sleep(time.Millisecond)
	channel2M, _ = th.App.GetChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)
	assert.Equal(t, model.CHANNEL_NOTIFY_ALL, channel2M.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])
}
