// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"strings"
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

func (me *msgProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {

	splitMessage := strings.SplitN(message, " ", 2)

	parsedMessage := ""
	targetUser := ""

	if len(splitMessage) > 1 {
		parsedMessage = strings.SplitN(message, " ", 2)[1]
	}
	targetUser = strings.SplitN(message, " ", 2)[0]
	targetUser = strings.TrimPrefix(targetUser, "@")

	if profileList := <-Srv.Store.User().GetAllProfiles(); profileList.Err != nil {
		c.Err = profileList.Err
		return &model.CommandResponse{Text: c.T("api.command_msg.list.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		profileUsers := profileList.Data.(map[string]*model.User)
		for _, userProfile := range profileUsers {
			//Don't let users open DMs with themselves. It probably won't work out well.
			if userProfile.Id == c.Session.UserId {
				continue
			}
			if userProfile.Username == targetUser {
				targetChannelId := ""

				//Find the channel based on this user
				channelName := model.GetDMNameFromIds(c.Session.UserId, userProfile.Id)

				if channel := <-Srv.Store.Channel().GetByName(c.TeamId, channelName); channel.Err != nil {
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

				makeDirectChannelVisible(c.TeamId, targetChannelId)
				if len(parsedMessage) > 0 {
					post := &model.Post{}
					post.Message = parsedMessage
					post.ChannelId = targetChannelId
					if _, err := CreatePost(c, post, true); err != nil {
						return &model.CommandResponse{Text: c.T("api.command_msg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
					}
				}

				return &model.CommandResponse{GotoLocation: c.GetTeamURL() + "/channels/" + channelName, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			}
		}
	}

	return &model.CommandResponse{Text: c.T("api.command_msg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
