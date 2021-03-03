// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type PurposeProvider struct {
}

const (
	CmdPurpose = "purpose"
)

func init() {
	app.RegisterCommandProvider(&PurposeProvider{})
}

func (*PurposeProvider) GetTrigger() string {
	return CmdPurpose
}

func (*PurposeProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdPurpose,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_purpose.desc"),
		AutoCompleteHint: T("api.command_channel_purpose.hint"),
		DisplayName:      T("api.command_channel_purpose.name"),
	}
}

func (*PurposeProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_purpose.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_purpose.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	case model.CHANNEL_PRIVATE:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_purpose.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_purpose.direct_group.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_purpose.message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	patch := &model.ChannelPatch{
		Purpose: new(string),
	}
	*patch.Purpose = message

	_, err = a.PatchChannel(channel, patch, args.UserId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_purpose.update_channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	return &model.CommandResponse{}
}
