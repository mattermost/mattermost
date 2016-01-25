// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type MeProvider struct {
}

func init() {
	RegisterCommandProvider(&MeProvider{})
}

func (me *MeProvider) GetCommand() *model.Command {
	return &model.Command{
		Trigger:          "me",
		AutoComplete:     true,
		AutoCompleteDesc: "Do an action",
		AutoCompleteHint: "[message]",
		DisplayName:      "me",
	}
}

func (me *MeProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL, Text: "*" + message + "*"}
}
