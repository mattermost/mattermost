// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type JoinProvider struct {
}

const (
	CmdJoin = "join"
)

func init() {
	app.RegisterCommandProvider(&JoinProvider{})
}

func (*JoinProvider) GetTrigger() string {
	return CmdJoin
}

func (*JoinProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdJoin,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_join.desc"),
		AutoCompleteHint: T("api.command_join.hint"),
		DisplayName:      T("api.command_join.name"),
	}
}

func (*JoinProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	channelName := strings.ToLower(message)

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
