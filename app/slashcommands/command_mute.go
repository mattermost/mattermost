// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type MuteProvider struct {
}

const (
	CmdMute = "mute"
)

func init() {
	app.RegisterCommandProvider(&MuteProvider{})
}

func (*MuteProvider) GetTrigger() string {
	return CmdMute
}

func (*MuteProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdMute,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_mute.desc"),
		AutoCompleteHint: T("api.command_mute.hint"),
		DisplayName:      T("api.command_mute.name"),
	}
}

func (*MuteProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
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

	if channelName != "" && message != "" {
		channel, _ = a.Srv().Store.Channel().GetByName(channel.TeamId, channelName, true)

		if channel == nil {
			return &model.CommandResponse{Text: args.T("api.command_mute.error", map[string]interface{}{"Channel": channelName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	channelMember, err := a.ToggleMuteChannel(channel.Id, args.UserId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_mute.not_member.error", map[string]interface{}{"Channel": channelName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Direct and Group messages won't have a nice channel title, omit it
	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		if channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MENTION {
			return &model.CommandResponse{Text: args.T("api.command_mute.success_mute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
		return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute_direct_msg"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MENTION {
		return &model.CommandResponse{Text: args.T("api.command_mute.success_mute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	return &model.CommandResponse{Text: args.T("api.command_mute.success_unmute", map[string]interface{}{"Channel": channel.DisplayName}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
