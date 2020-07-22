// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type AwayProvider struct {
}

const (
	CMD_AWAY = "away"
)

func init() {
	RegisterCommandProvider(&AwayProvider{})
}

func (me *AwayProvider) GetTrigger() string {
	return CMD_AWAY
}

func (me *AwayProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_AWAY,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_away.desc"),
		DisplayName:      T("api.command_away.name"),
	}
}

func (me *AwayProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusAwayIfNeeded(args.UserId, true)

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_away.success")}
}
