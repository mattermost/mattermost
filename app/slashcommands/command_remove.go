// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type RemoveProvider struct {
}

type KickProvider struct {
}

const (
	CmdRemove = "remove"
	CmdKick   = "kick"
)

func init() {
	app.RegisterCommandProvider(&RemoveProvider{})
	app.RegisterCommandProvider(&KickProvider{})
}

func (*RemoveProvider) GetTrigger() string {
	return CmdRemove
}

func (*KickProvider) GetTrigger() string {
	return CmdKick
}

func (*RemoveProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdRemove,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_remove.desc"),
		AutoCompleteHint: T("api.command_remove.hint"),
		DisplayName:      T("api.command_remove.name"),
	}
}

func (*KickProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdKick,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_remove.desc"),
		AutoCompleteHint: T("api.command_remove.hint"),
		DisplayName:      T("api.command_kick.name"),
	}
}

func (*RemoveProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(a, args, message)
}

func (*KickProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(a, args, message)
}

func doCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_remove.channel.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			return &model.CommandResponse{
				Text:         args.T("api.command_remove.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	case model.CHANNEL_PRIVATE:
		if !a.HasPermissionToChannel(args.UserId, args.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			return &model.CommandResponse{
				Text:         args.T("api.command_remove.permission.app_error"),
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			}
		}
	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.direct_group.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.message.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	targetUsername := ""

	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	userProfile, nErr := a.Srv().Store.User().GetByUsername(targetUsername)
	if nErr != nil {
		mlog.Error(nErr.Error())
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.missing.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}
	if userProfile.DeleteAt != 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.missing.app_error"),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	_, err = a.GetChannelMember(context.Background(), args.ChannelId, userProfile.Id)
	if err != nil {
		nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
		return &model.CommandResponse{
			Text: args.T("api.command_remove.user_not_in_channel", map[string]interface{}{
				"Username": userProfile.GetDisplayName(nameFormat),
			}),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if err = a.RemoveUserFromChannel(userProfile.Id, args.UserId, channel); err != nil {
		var text string
		if err.Id == "api.channel.remove_members.denied" {
			text = args.T("api.command_remove.group_constrained_user_denied")
		} else {
			text = args.T(err.Id, map[string]interface{}{
				"Channel": model.DEFAULT_CHANNEL,
			})
		}
		return &model.CommandResponse{
			Text:         text,
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	return &model.CommandResponse{}
}
