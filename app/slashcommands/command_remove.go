// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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

func (*RemoveProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(a, c, args, message)
}

func (*KickProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return doCommand(a, c, args, message)
}

func doCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	channel, err := a.GetChannel(c, args.ChannelId)
	if err != nil {
		return &model.CommandResponse{
			Text:         args.T("api.command_channel_remove.channel.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !a.HasPermissionToChannel(c, args.UserId, args.ChannelId, model.PermissionManagePublicChannelMembers) {
			return &model.CommandResponse{
				Text:         args.T("api.command_remove.permission.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
	case model.ChannelTypePrivate:
		if !a.HasPermissionToChannel(c, args.UserId, args.ChannelId, model.PermissionManagePrivateChannelMembers) {
			return &model.CommandResponse{
				Text:         args.T("api.command_remove.permission.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
	default:
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.direct_group.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if message == "" {
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.message.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
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
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}
	if userProfile.DeleteAt != 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_remove.missing.app_error"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	_, err = a.GetChannelMember(c, args.ChannelId, userProfile.Id)
	if err != nil {
		nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
		return &model.CommandResponse{
			Text: args.T("api.command_remove.user_not_in_channel", map[string]any{
				"Username": userProfile.GetDisplayName(nameFormat),
			}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	if err = a.RemoveUserFromChannel(c, userProfile.Id, args.UserId, channel); err != nil {
		var text string
		if err.Id == "api.channel.remove_members.denied" {
			text = args.T("api.command_remove.group_constrained_user_denied")
		} else {
			text = args.T(err.Id, map[string]any{
				"Channel": model.DefaultChannelName,
			})
		}
		return &model.CommandResponse{
			Text:         text,
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	return &model.CommandResponse{}
}
