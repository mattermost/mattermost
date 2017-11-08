// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type LeaveProvider struct {
}

const (
	CMD_LEAVE = "leave"
)

func init() {
	RegisterCommandProvider(&LeaveProvider{})
}

func (me *LeaveProvider) GetTrigger() string {
	return CMD_LEAVE
}

func (me *LeaveProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_LEAVE,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_leave.desc"),
		DisplayName:      T("api.command_leave.name"),
	}
}

func (me *LeaveProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	var channel *model.Channel
	var noChannelErr *model.AppError
	if channel, noChannelErr = a.GetChannel(args.ChannelId); noChannelErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_leave.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	if channel.Name == model.DEFAULT_CHANNEL {
		return &model.CommandResponse{Text: args.T("api.channel.leave.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	err := a.LeaveChannel(args.ChannelId, args.UserId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_leave.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	team, err := a.GetTeam(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_leave.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + model.DEFAULT_CHANNEL, Text: args.T("api.command_leave.success"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
