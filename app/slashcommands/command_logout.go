// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type LogoutProvider struct {
}

const (
	CMD_LOGOUT = "logout"
)

func init() {
	app.RegisterCommandProvider(&LogoutProvider{})
}

func (me *LogoutProvider) GetTrigger() string {
	return CMD_LOGOUT
}

func (me *LogoutProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_LOGOUT,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_logout.desc"),
		AutoCompleteHint: "",
		DisplayName:      T("api.command_logout.name"),
	}
}

func (me *LogoutProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	// Actual logout is handled client side.
	return &model.CommandResponse{GotoLocation: "/login"}
}
