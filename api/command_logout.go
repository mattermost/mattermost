// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
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

func (me *LogoutProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_LOGOUT,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_logout.desc"),
		AutoCompleteHint: "",
		DisplayName:      c.T("api.command_logout.name"),
	}
}

func (me *LogoutProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	FAIL := &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command_logout.fail_message")}
	SUCCESS := &model.CommandResponse{GotoLocation: "/", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command_logout.success_message")}

	// We can't actually remove the user's cookie from here so we just dump their session and let the browser figure it out
	if c.Session.Id != "" {
		RevokeSessionById(c, c.Session.Id)
		if c.Err != nil {
			return FAIL
		}
		return SUCCESS
	}
	return FAIL
}
