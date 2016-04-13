// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
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

func (me *AwayProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_AWAY,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_away.desc"),
		AutoCompleteHint: c.T("api.command_away.hint"),
		DisplayName:      c.T("api.command_away.name"),
	}
}

func (me *AwayProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	err := UpdateStatus(c.Session.UserId, model.USER_AWAY)
	if err == nil {
		message = c.T("api.command_away.ok")
	} else {
		message = c.T("api.command_away.error")
		l4g.Error(err.ToJson())
	}

	return &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Text:         message}
}
