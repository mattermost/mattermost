// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type OnlineProvider struct {
}

const (
	CmdOnline = "online"
)

func init() {
	app.RegisterCommandProvider(&OnlineProvider{})
}

func (*OnlineProvider) GetTrigger() string {
	return CmdOnline
}

func (*OnlineProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdOnline,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_online.desc"),
		DisplayName:      T("api.command_online.name"),
	}
}

func (*OnlineProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusOnline(args.UserId, true)

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_online.success")}
}
