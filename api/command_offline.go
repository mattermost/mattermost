// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

type OfflineProvider struct {
}

const (
	CMD_OFFLINE = "offline"
)

func init() {
	RegisterCommandProvider(&OfflineProvider{})
}

func (me *OfflineProvider) GetTrigger() string {
	return CMD_OFFLINE
}

func (me *OfflineProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:      CMD_OFFLINE,
		AutoComplete: true,
		// TODO: translations
		AutoCompleteDesc: "offline", //c.T("api.command_shrug.desc"),
		AutoCompleteHint: "offline", //c.T("api.command_shrug.hint"),
		DisplayName:      "offline", //c.T("api.command_shrug.name"),
	}
}

func (me *OfflineProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	err := UpdateStatus(c.Session.UserId, model.USER_OFFLINE)
	if err == nil {
		message = "You are now offline"
	} else {
		message = "Something went wrong... cannot change your status"
		l4g.Error(err.ToJson())
	}

	return &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Text:         message}
}
