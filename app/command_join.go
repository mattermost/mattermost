// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type JoinProvider struct {
}

const (
	CMD_JOIN = "join"
)

func init() {
	RegisterCommandProvider(&JoinProvider{})
}

func (me *JoinProvider) GetTrigger() string {
	return CMD_JOIN
}

func (me *JoinProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_JOIN,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_join.desc"),
		AutoCompleteHint: T("api.command_join.hint"),
		DisplayName:      T("api.command_join.name"),
	}
}

func (me *JoinProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	if result := <-a.Srv.Store.Channel().GetByName(args.TeamId, message, true); result.Err != nil {
		return &model.CommandResponse{Text: args.T("api.command_join.list.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		channel := result.Data.(*model.Channel)

		if channel.Name == message {
			allowed := false
			if (channel.Type == model.CHANNEL_PRIVATE && a.SessionHasPermissionToChannel(args.Session, channel.Id, model.PERMISSION_READ_CHANNEL)) || channel.Type == model.CHANNEL_OPEN {
				allowed = true
			}

			if !allowed {
				return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}

			if err := a.JoinChannel(channel, args.UserId); err != nil {
				return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}

			team, err := a.GetTeam(channel.TeamId)
			if err != nil {
				return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}

			return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + channel.Name}
		}
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_join.missing.app_error")}
}
