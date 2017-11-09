// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
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

func (me *InvitePeopleProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	autoComplete := true
	if !a.Config().EmailSettings.SendEmailNotifications || !a.Config().TeamSettings.EnableUserCreation {
		autoComplete = false
	}
	return &model.Command{
		Trigger:          CMD_INVITE_PEOPLE,
		AutoComplete:     autoComplete,
		AutoCompleteDesc: T("api.command.invite_people.desc"),
		AutoCompleteHint: T("api.command.invite_people.hint"),
		DisplayName:      T("api.command.invite_people.name"),
	}
}

func (me *InvitePeopleProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.Config().EmailSettings.SendEmailNotifications {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command.invite_people.email_off")}
	}

	if !a.Config().TeamSettings.EnableUserCreation {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command.invite_people.invite_off")}
	}

	emailList := strings.Fields(message)

	for i := len(emailList) - 1; i >= 0; i-- {
		emailList[i] = strings.Trim(emailList[i], ",")
		if !strings.Contains(emailList[i], "@") {
			emailList = append(emailList[:i], emailList[i+1:]...)
		}
	}

	if len(emailList) == 0 {
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command.invite_people.no_email")}
	}

	if err := a.InviteNewUsersToTeam(emailList, args.TeamId, args.UserId); err != nil {
		l4g.Error(err.Error())
		return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command.invite_people.fail")}
	}

	return &model.CommandResponse{ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL, Text: args.T("api.command.invite_people.sent")}
}
