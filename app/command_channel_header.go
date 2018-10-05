// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/model"
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

func (me *HeaderProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_HEADER,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_header.desc"),
		AutoCompleteHint: T("api.command_channel_header.hint"),
		DisplayName:      T("api.command_channel_header.name"),
	}
}

func (me *HeaderProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}

	case model.CHANNEL_PRIVATE:
		if !a.SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		channelMember, err := a.GetChannelMember(args.ChannelId, args.Session.UserId)
		if err != nil || channelMember == nil {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}

	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.permission.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if len(message) == 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	patch := &model.ChannelPatch{
		Header: new(string),
	}
	*patch.Header = message

	_, err = a.PatchChannel(channel, patch, args.UserId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.update_channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	return &model.CommandResponse{}
}
