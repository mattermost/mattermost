// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"strings"
)

type GotoProvider struct {
}

const (
	CMD_GOTO = "goto"
)

func init() {
	RegisterCommandProvider(&GotoProvider{})
}

func (me *GotoProvider) GetTrigger() string {
	return CMD_GOTO
}

func (me *GotoProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_GOTO,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_goto.desc"),
		AutoCompleteHint: c.T("api.command_goto.hint"),
		DisplayName:      c.T("api.command_goto.name"),
	}
}

func (me *GotoProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	
	if !strings.Contains(message, "http") {
		message = "http://" + message;
	}

	if !model.IsValidHttpUrl(message) || !strings.Contains(message, ".") {
		return &model.CommandResponse{Text: c.T("api.command_goto.fail.url"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: message, Text: c.T("api.command_goto.success"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
