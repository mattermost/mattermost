// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/model"
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
	channelName := message

	if strings.HasPrefix(message, "~") {
		channelName = message[1:]
	}

	result := <-a.Srv.Store.Channel().GetByName(args.TeamId, channelName, true)
	if result.Err != nil {
		return &model.CommandResponse{Text: args.T("api.command_join.list.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	channel := result.Data.(*model.Channel)

	if channel.Name != channelName {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_join.missing.app_error")}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.SessionHasPermissionToChannel(args.Session, channel.Id, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	case model.CHANNEL_PRIVATE:
		if !a.SessionHasPermissionToChannel(args.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	default:
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
