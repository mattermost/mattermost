// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"

	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type HeaderProvider struct {
}

const (
	CMD_HEADER = "header"
)

func init() {
	RegisterCommandProvider(&HeaderProvider{})
}

func (me *HeaderProvider) GetTrigger() string {
	return CMD_HEADER
}

func (me *HeaderProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_HEADER,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_header.desc"),
		AutoCompleteHint: T("api.command_channel_header.hint"),
		DisplayName:      T("api.command_channel_header.name"),
	}
}

func (me *HeaderProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_channel_header.channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_OPEN && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_channel_header.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_PRIVATE && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_channel_header.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if len(message) == 0 {
		return &model.CommandResponse{Text: args.T("api.command_channel_header.message.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	oldChannelHeader := channel.Header
	channel.Header = message

	updateChannel, err := UpdateChannel(channel)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_channel_header.update_channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_UPDATED, "", channel.Id, "", nil)
	messageWs.Add("channel", channel.ToJson())
	Publish(messageWs)

	if err := PostUpdateChannelHeaderMessage(args.Session.UserId, channel.Id, args.TeamId, oldChannelHeader, updateChannel.Header); err != nil {
		l4g.Error(err.Error())
	}

	return &model.CommandResponse{}
}
