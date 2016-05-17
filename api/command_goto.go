// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
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
	return CMD_Goto
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
	
}
