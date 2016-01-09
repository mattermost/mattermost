// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type LogoutProvider struct {
}

func init() {
	RegisterCommandProvider(&LogoutProvider{})
}

func (me *LogoutProvider) GetCommand() *model.Command {
	return &model.Command{
		Trigger:          "logout",
		AutoComplete:     true,
		AutoCompleteDesc: "Logout",
		AutoCompleteHint: "",
		DisplayName:      "logout",
	}
}

func (me *LogoutProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return &model.CommandResponse{GotoLocation: "/logout", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: "Logging out..."}
}
