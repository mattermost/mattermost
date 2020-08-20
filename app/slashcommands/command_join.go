// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type JoinProvider struct {
}

const (
	CMD_JOIN = "join"
)

func init() {
	app.RegisterCommandProvider(&JoinProvider{})
}

func (me *JoinProvider) GetTrigger() string {
	return CMD_JOIN
}

func (me *JoinProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_JOIN,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_join.desc"),
		AutoCompleteHint: T("api.command_join.hint"),
		DisplayName:      T("api.command_join.name"),
	}
}

func (me *JoinProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channelName := message

	if strings.HasPrefix(message, "~") {
		channelName = message[1:]
	}

	channel, err := a.Srv().Store.Channel().GetByName(args.TeamId, channelName, true)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_join.list.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if channel.Name != channelName {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_join.missing.app_error")}
	}

	switch channel.Type {
	case model.CHANNEL_OPEN:
		if !a.HasPermissionToChannel(args.UserId, channel.Id, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	case model.CHANNEL_PRIVATE:
		if !a.HasPermissionToChannel(args.UserId, channel.Id, model.PERMISSION_READ_CHANNEL) {
			return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	default:
		return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if appErr := a.JoinChannel(channel, args.UserId); appErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	team, appErr := a.GetTeam(channel.TeamId)
	if appErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + channel.Name}
}
