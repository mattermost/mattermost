// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/model"
)

type LogoutProvider struct {
}

const (
	CMD_LOGOUT = "logout"
)

func init() {
	RegisterCommandProvider(&LogoutProvider{})
}

func (me *LogoutProvider) GetTrigger() string {
	return CMD_LOGOUT
}

func (me *LogoutProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_LOGOUT,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_logout.desc"),
		AutoCompleteHint: "",
		DisplayName:      T("api.command_logout.name"),
	}
}

func (me *LogoutProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	FAIL := &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command_logout.fail_message")}
	SUCCESS := &model.CommandResponse{GotoLocation: "/login"}

	// We can't actually remove the user's cookie from here so we just dump their session and let the browser figure it out
	if args.Session.Id != "" {
		if err := a.RevokeSessionById(args.Session.Id); err != nil {
			return FAIL
		}
		return SUCCESS
	}
	return FAIL
}
