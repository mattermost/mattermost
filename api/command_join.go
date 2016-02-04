// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

type JoinProvider struct {
}

const (
	CMD_JOIN = "join"
)

func init() {
	RegisterCommandProvider(&JoinProvider{})
}

func (me *JoinProvider) GetTrigger() string {
	return CMD_JOIN
}

func (me *JoinProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_JOIN,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_join.desc"),
		AutoCompleteHint: c.T("api.command_join.hint"),
		DisplayName:      c.T("api.command_join.name"),
	}
}

func (me *JoinProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	if result := <-Srv.Store.Channel().GetMoreChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		return &model.CommandResponse{Text: c.T("api.command_join.list.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		channels := result.Data.(*model.ChannelList)

		for _, v := range channels.Channels {

			if v.Name == message {

				if v.Type == model.CHANNEL_DIRECT {
					return &model.CommandResponse{Text: c.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
				}

				JoinChannel(c, v.Id, "")

				if c.Err != nil {
					c.Err = nil
					return &model.CommandResponse{Text: c.T("api.command_join.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
				}

				return &model.CommandResponse{GotoLocation: c.GetTeamURL() + "/channels/" + v.Name, Text: c.T("api.command_join.success"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}
		}
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command_join.missing.app_error")}
}
