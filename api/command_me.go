// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type MeProvider struct {
}

const (
	CMD_ME = "me"
)

func init() {
	RegisterCommandProvider(&MeProvider{})
}

func (me *MeProvider) GetTrigger() string {
	return CMD_ME
}

func (me *MeProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_ME,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_me.desc"),
		AutoCompleteHint: c.T("api.command_me.hint"),
		DisplayName:      c.T("api.command_me.name"),
	}
}

func (me *MeProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL, Text: "*" + message + "*"}
}
