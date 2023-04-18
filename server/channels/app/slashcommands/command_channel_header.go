// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
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

func (*HeaderProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(c, args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.channel.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !a.HasPermissionToChannel(c, args.UserId, args.ChannelId, model.PermissionManagePublicChannelProperties) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

	case model.ChannelTypePrivate:
		if !a.HasPermissionToChannel(c, args.UserId, args.ChannelId, model.PermissionManagePrivateChannelProperties) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		var channelMember *model.ChannelMember
		channelMember, err = a.GetChannelMember(c, args.ChannelId, args.UserId)
		if err != nil || channelMember == nil {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_header.permission.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.permission.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_header.message.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	patch := &model.ChannelPatch{
		Header: new(string),
	}
	*patch.Header = message

	_, err = a.PatchChannel(c, channel, patch, args.UserId)
	if err != nil {
		text := args.T("api.command_channel_header.update_channel.app_error")
		if err.Id == "model.channel.is_valid.header.app_error" {
			text = args.T("api.command_channel_header.update_channel.max_length", map[string]any{
				"MaxLength": model.ChannelHeaderMaxRunes,
			})
		}

		return &model.CommandResponse{
			Text:         text,
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	return &model.CommandResponse{}
}
