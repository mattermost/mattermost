// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"

	"github.com/mattermost/platform/model"
)

type msgProvider struct {
}

const (
	CMD_MSG = "msg"
)

func init() {
	RegisterCommandProvider(&msgProvider{})
}

func (me *msgProvider) GetTrigger() string {
	return CMD_MSG
}

func (me *msgProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_MSG,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_msg.desc"),
		AutoCompleteHint: c.T("api.command_msg.hint"),
		DisplayName:      c.T("api.command_msg.name"),
	}
}

func (me *msgProvider) DoCommand(c *Context, args *model.CommandArgs, message string) *model.CommandResponse {

	splitMessage := strings.SplitN(message, " ", 2)

	parsedMessage := ""
	targetUsername := ""

	if len(splitMessage) > 1 {
		parsedMessage = strings.SplitN(message, " ", 2)[1]
	}
	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	var userProfile *model.User
	if result := <-Srv.Store.User().GetByUsername(targetUsername); result.Err != nil {
		c.Err = result.Err
		return &model.CommandResponse{Text: c.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		userProfile = result.Data.(*model.User)
	}

	if userProfile.Id == c.Session.UserId {
		return &model.CommandResponse{Text: c.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Find the channel based on this user
	channelName := model.GetDMNameFromIds(c.Session.UserId, userProfile.Id)

	targetChannelId := ""
	if channel := <-Srv.Store.Channel().GetByName(c.TeamId, channelName, true); channel.Err != nil {
		if channel.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
			if directChannel, err := CreateDirectChannel(c.Session.UserId, userProfile.Id); err != nil {
				c.Err = err
				return &model.CommandResponse{Text: c.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			} else {
				targetChannelId = directChannel.Id
			}
		} else {
			c.Err = channel.Err
			return &model.CommandResponse{Text: c.T("api.command_msg.dm_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		targetChannelId = channel.Data.(*model.Channel).Id
	}

	if len(parsedMessage) > 0 {
		post := &model.Post{}
		post.Message = parsedMessage
		post.ChannelId = targetChannelId
		post.UserId = c.Session.UserId
		if _, err := CreatePost(c, post, true); err != nil {
			return &model.CommandResponse{Text: c.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	return &model.CommandResponse{GotoLocation: c.GetTeamURL() + "/channels/" + channelName, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
