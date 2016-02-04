// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type ShrugProvider struct {
}

const (
	CMD_SHRUG = "shrug"
)

func init() {
	RegisterCommandProvider(&ShrugProvider{})
}

func (me *ShrugProvider) GetTrigger() string {
	return CMD_SHRUG
}

func (me *ShrugProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_SHRUG,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_shrug.desc"),
		AutoCompleteHint: c.T("api.command_shrug.hint"),
		DisplayName:      c.T("api.command_shrug.name"),
	}
}

func (me *ShrugProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	rmsg := `¯\\\_(ツ)\_/¯`
	if len(message) > 0 {
		rmsg = message + " " + rmsg
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL, Text: rmsg}
}
