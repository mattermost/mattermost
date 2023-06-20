// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
)

type AwayProvider struct {
}

const (
	CmdAway = "away"
)

func init() {
	app.RegisterCommandProvider(&AwayProvider{})
}

func (*AwayProvider) GetTrigger() string {
	return CmdAway
}

func (*AwayProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdAway,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_away.desc"),
		DisplayName:      T("api.command_away.name"),
	}
}

func (*AwayProvider) DoCommand(a *app.App, _ request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusAwayIfNeeded(args.UserId, true)

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_away.success")}
}
