// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type ShrugProvider struct {
}

func init() {
	RegisterCommandProvider(&ShrugProvider{})
}

func (me *ShrugProvider) GetCommand() *model.Command {
	return &model.Command{
		Trigger:          "shrug",
		AutoComplete:     true,
		AutoCompleteDesc: `Adds ¯\_(ツ)_/¯ to your message`,
		AutoCompleteHint: "[message]",
		DisplayName:      "shrug",
	}
}

func (me *ShrugProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL, Text: `¯\_(ツ)_/¯`}
}
