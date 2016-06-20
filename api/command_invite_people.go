// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type InvitePeopleProvider struct {
}

const (
	CMD_INVITE_PEOPLE = "invite_people"
)

func init() {
	RegisterCommandProvider(&InvitePeopleProvider{})
}

func (me *InvitePeopleProvider) GetTrigger() string {
	return CMD_INVITE_PEOPLE
}

func (me *InvitePeopleProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_INVITE_PEOPLE,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command.invite_people.desc"),
		AutoCompleteHint: c.T("api.command.invite_people.hint"),
		DisplayName:      c.T("api.command.invite_people.name"),
	}
}

func (me *InvitePeopleProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	if !utils.Cfg.EmailSettings.SendEmailNotifications {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command.invite_people.email_off")}
	}

	tchan := Srv.Store.Team().Get(c.TeamId)
	uchan := Srv.Store.User().Get(c.Session.UserId)

	emailList := strings.Fields(message)

	for i := len(emailList) - 1; i >= 0; i-- {
		emailList[i] = strings.Trim(emailList[i], ",")
		if !strings.Contains(emailList[i], "@") {
			emailList = append(emailList[:i], emailList[i+1:]...)
		}
	}

	if len(emailList) == 0 {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command.invite_people.no_email")}
	}

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command.invite_people.fail")}
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command.invite_people.fail")}
	} else {
		user = result.Data.(*model.User)
	}

	go InviteMembers(c, team, user, emailList)

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: c.T("api.command.invite_people.sent")}
}
