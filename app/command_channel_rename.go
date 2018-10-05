// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/model"
)

type RenameProvider struct {
}

const (
	CMD_RENAME = "rename"
)

func init() {
	RegisterCommandProvider(&RenameProvider{})
}

func (me *RenameProvider) GetTrigger() string {
	return CMD_RENAME
}

func (me *RenameProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_RENAME,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_rename.desc"),
		AutoCompleteHint: T("api.command_channel_rename.hint"),
		DisplayName:      T("api.command_channel_rename.name"),
	}
}

func (me *RenameProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_rename.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_rename.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	case model.CHANNEL_PRIVATE:
		if !a.SessionHasPermissionToChannel(args.Session, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_rename.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	default:
		return &model.CommandResponse{Text: args.T("api.command_channel_rename.direct_group.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if len(message) == 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_rename.message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	} else if len(message) > model.CHANNEL_NAME_UI_MAX_LENGTH {
		return &model.CommandResponse{
			Text: args.T("api.command_channel_rename.too_long.app_error", map[string]interface{}{
				"Length": model.CHANNEL_NAME_UI_MAX_LENGTH,
			}),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	} else if len(message) < model.CHANNEL_NAME_MIN_LENGTH {
		return &model.CommandResponse{
			Text: args.T("api.command_channel_rename.too_short.app_error", map[string]interface{}{
				"Length": model.CHANNEL_NAME_MIN_LENGTH,
			}),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	patch := &model.ChannelPatch{
		DisplayName: new(string),
	}
	*patch.DisplayName = message

	_, err = a.PatchChannel(channel, patch, args.UserId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_rename.update_channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	return &model.CommandResponse{}
}
