// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type MuteProvider struct {
}

const (
	CMD_MUTE = "mute"
)

func init() {
	RegisterCommandProvider(&MuteProvider{})
}

func (me *MuteProvider) GetTrigger() string {
	return CMD_MUTE
}

func (me *MuteProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_MUTE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_mute.desc"),
		AutoCompleteHint: T("api.command_mute.hint"),
		DisplayName:      T("api.command_mute.name"),
	}
}

func (me *MuteProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	var channel *model.Channel
	var noChannelErr *model.AppError

	if channel, noChannelErr = a.GetChannel(args.ChannelId); noChannelErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_mute.no_channel.error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	channelName := ""
	splitMessage := strings.Split(message, " ")
	// Overwrite channel with channel-handle if set
	if strings.HasPrefix(message, "~") {
		channelName = splitMessage[0][1:]
	} else {
		channelName = splitMessage[0]
	}

	if len(channelName) > 0 && len(message) > 0 {
		channel, _ = a.Srv.Store.Channel().GetByName(channel.TeamId, channelName, true)

		if channel == nil {
			return &model.CommandResponse{Text: args.T("api.command_mute.error", map[string]interface{}{"Channel": channelName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	channelMember := a.ToggleMuteChannel(channel.Id, args.UserId)
	if channelMember == nil {
		return &model.CommandResponse{Text: args.T("api.command_mute.not_member.error", map[string]interface{}{"Channel": channelName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Invalidate cache to allow cache lookups while sending notifications
	a.Srv.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channel.Id)

	// Direct and Group messages won't have a nice channel title, omit it
	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		if channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MENTION {
			publishChannelMemberEvt(a, channelMember, args.UserId)
			return &model.CommandResponse{Text: args.T("api.command_mute.success_mute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		} else {
			publishChannelMemberEvt(a, channelMember, args.UserId)
			return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	if channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MENTION {
		publishChannelMemberEvt(a, channelMember, args.UserId)
		return &model.CommandResponse{Text: args.T("api.command_mute.success_mute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		publishChannelMemberEvt(a, channelMember, args.UserId)
		return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
}

func publishChannelMemberEvt(a *App, channelMember *model.ChannelMember, userId string) {
	evt := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_MEMBER_UPDATED, "", "", userId, nil)
	evt.Add("channelMember", channelMember.ToJson())
	a.Publish(evt)
}
