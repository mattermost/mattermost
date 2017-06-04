// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type PurposeProvider struct {
}

const (
	CMD_PURPOSE = "purpose"
)

func init() {
	RegisterCommandProvider(&PurposeProvider{})
}

func (me *PurposeProvider) GetTrigger() string {
	return CMD_PURPOSE
}

func (me *PurposeProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_PURPOSE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_purpose.desc"),
		AutoCompleteHint: T("api.command_channel_purpose.hint"),
		DisplayName:      T("api.command_channel_purpose.name"),
	}
}

func (me *PurposeProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_channel_purpose.channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_OPEN && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_channel_purpose.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Type == model.CHANNEL_PRIVATE && !SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		return &model.CommandResponse{Text: args.T("api.command_channel_purpose.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if len(message) == 0 {
		return &model.CommandResponse{Text: args.T("api.command_channel_purpose.message.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	oldChannelPurpose := channel.Purpose
	channel.Purpose = message

	updateChannel, err := UpdateChannel(channel)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_channel_purpose.update_channel.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_UPDATED, "", channel.Id, "", nil)
	messageWs.Add("channel", channel.ToJson())
	Publish(messageWs)

	if err := PostUpdateChannelPurposeMessage(args.Session.UserId, channel.Id, args.TeamId, oldChannelPurpose, updateChannel.Purpose); err != nil {
		l4g.Error(err.Error())
	}

	return &model.CommandResponse{}
}
