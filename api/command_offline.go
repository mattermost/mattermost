// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
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
		Trigger:          CMD_OFFLINE,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_offline.desc"),
		DisplayName:      c.T("api.command_offline.name"),
	}
}

func (me *OfflineProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	rmsg := c.T("api.command_offline.success")
	if len(message) > 0 {
		rmsg = message + " " + rmsg
	}
	SetStatusOffline(c.Session.UserId, true)

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: rmsg}
}
