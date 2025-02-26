// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type InvitePeopleProvider struct {
}

const (
	CmdInvitePeople = "invite_people"
)

func init() {
	app.RegisterCommandProvider(&InvitePeopleProvider{})
}

func (*InvitePeopleProvider) GetTrigger() string {
	return CmdInvitePeople
}

func (*InvitePeopleProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	autoComplete := true
	if !*a.Config().EmailSettings.SendEmailNotifications || !*a.Config().TeamSettings.EnableUserCreation || !*a.Config().ServiceSettings.EnableEmailInvitations {
		autoComplete = false
	}
	return &model.Command{
		Trigger:          CmdInvitePeople,
		AutoComplete:     autoComplete,
		AutoCompleteDesc: T("api.command.invite_people.desc"),
		AutoCompleteHint: T("api.command.invite_people.hint"),
		DisplayName:      T("api.command.invite_people.name"),
	}
}

func (*InvitePeopleProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionToTeam(c, args.UserId, args.TeamId, model.PermissionInviteUser) {
		return &model.CommandResponse{Text: args.T("api.command_invite_people.permission.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	if !a.HasPermissionToTeam(c, args.UserId, args.TeamId, model.PermissionAddUserToTeam) {
		return &model.CommandResponse{Text: args.T("api.command_invite_people.permission.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	if !*a.Config().EmailSettings.SendEmailNotifications {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.email_off")}
	}

	if !*a.Config().TeamSettings.EnableUserCreation {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.invite_off")}
	}

	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.email_invitations_off")}
	}

	emailList := strings.Fields(message)

	for i := len(emailList) - 1; i >= 0; i-- {
		emailList[i] = strings.Trim(emailList[i], ",")
		if !strings.Contains(emailList[i], "@") {
			emailList = append(emailList[:i], emailList[i+1:]...)
		}
	}

	if len(emailList) == 0 {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.no_email")}
	}

	if err := a.InviteNewUsersToTeam(c, emailList, args.TeamId, args.UserId); err != nil {
		c.Logger().Error(err.Error())
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.fail")}
	}

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command.invite_people.sent")}
}
