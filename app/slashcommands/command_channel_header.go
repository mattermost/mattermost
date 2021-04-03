// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type HeaderProvider struct {
}

const (
	CmdHeader = "header"
)

func init() {
	app.RegisterCommandProvider(&HeaderProvider{})
}

func (*HeaderProvider) GetTrigger() string {
	return CmdHeader
}

func (*HeaderProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdHeader,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_header.desc"),
		AutoCompleteHint: T("api.command_channel_header.hint"),
		DisplayName:      T("api.command_channel_header.name"),
	}
}

func (*HeaderProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}

	case model.CHANNEL_PRIVATE:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		var channelMember *model.ChannelMember
		channelMember, err = a.GetChannelMember(context.Background(), args.ChannelId, args.UserId)
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

	if message == "" {
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
