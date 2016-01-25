// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type JoinProvider struct {
}

func init() {
	RegisterCommandProvider(&JoinProvider{})
}

func (me *JoinProvider) GetCommand() *model.Command {
	return &model.Command{
		Trigger:          "join",
		AutoComplete:     true,
		AutoCompleteDesc: "Join the open channel",
		AutoCompleteHint: "[channel-name]",
		DisplayName:      "join",
	}
}

func (me *JoinProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	if result := <-Srv.Store.Channel().GetMoreChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		return &model.CommandResponse{Text: "An error occured while listing channels.", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		channels := result.Data.(*model.ChannelList)

		for _, v := range channels.Channels {

			if v.Name == message {

				if v.Type == model.CHANNEL_DIRECT {
					return &model.CommandResponse{Text: "An error occured while joining the channel.", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
				}

				JoinChannel(c, v.Id, "")

				if c.Err != nil {
					c.Err = nil
					return &model.CommandResponse{Text: "An error occured while joining the channel.", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
				}

				return &model.CommandResponse{GotoLocation: c.GetTeamURL() + "/channels/" + v.Name, Text: "Joined channel.", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}
		}
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: "We couldn't find the channel"}
}
