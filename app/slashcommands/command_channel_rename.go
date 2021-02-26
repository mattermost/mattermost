// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type RenameProvider struct {
}

const (
	CmdRename = "rename"
)

func init() {
	app.RegisterCommandProvider(&RenameProvider{})
}

func (*RenameProvider) GetTrigger() string {
	return CmdRename
}

func (*RenameProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	renameAutocompleteData := model.NewAutocompleteData(CmdRename, T("api.command_channel_rename.hint"), T("api.command_channel_rename.desc"))
	renameAutocompleteData.AddTextArgument(T("api.command_channel_rename.hint"), "[text]", "")
	return &model.Command{
		Trigger:          CmdRename,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_channel_rename.desc"),
		AutoCompleteHint: T("api.command_channel_rename.hint"),
		DisplayName:      T("api.command_channel_rename.name"),
		AutocompleteData: renameAutocompleteData,
	}
}

func (*RenameProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_rename.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_rename.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	case model.CHANNEL_PRIVATE:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			return &model.CommandResponse{
				Text:         args.T("api.command_channel_rename.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	default:
		return &model.CommandResponse{Text: args.T("api.command_channel_rename.direct_group.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_rename.message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	} else if len(message) > model.CHANNEL_NAME_MAX_LENGTH {
		return &model.CommandResponse{
			Text: args.T("api.command_channel_rename.too_long.app_error", map[string]interface{}{
				"Length": model.CHANNEL_NAME_MAX_LENGTH,
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
