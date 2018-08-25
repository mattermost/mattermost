// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)
type RemindProvider struct {
}

func init() {
	RegisterCommandProvider(&RemindProvider{})
}

func (me *RemindProvider) GetTrigger() string {
	return model.CMD_REMIND
}

func (me *RemindProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:			model.CMD_REMIND,
		AutoComplete:  		true,
		AutoCompleteDesc:	T("api.command_remind.desc"),
		AutoCompleteHint: 	T("api.command_remind.hint"),
		DisplayName:		T("api.command_remind.name"),
	}
}

func (me *RemindProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {

	_, _, translateFunc, _ := a.shared(args.UserId)

	if strings.HasSuffix(args.Command, translateFunc("help")) {
		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text: fmt.Sprintf(translateFunc(model.REMIND_HELP_TEXT)),
		}
	}

	if strings.HasSuffix(args.Command, translateFunc("list")) {
		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text: fmt.Sprintf(a.ListReminders(args.UserId)),
		}
	}

	if strings.HasSuffix(args.Command, translateFunc("clear")) {
		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text:         fmt.Sprintf(a.DeleteReminders(args.UserId)),
		}
	}

	payload := strings.Trim(strings.Replace(args.Command, "/"+model.CMD_REMIND, "", -1), " ")

	if strings.HasPrefix(payload, translateFunc("app.reminder.me")) ||
		strings.HasPrefix(payload, "@") ||
		strings.HasPrefix(payload, "~") {


		request := model.ReminderRequest{
			args.TeamId,
			args.UserId,
			payload,
			model.Reminder{},
			model.Occurrences{},
		}
		response, err := a.ScheduleReminder(&request)

		// TODO status update for webapp

		if err != nil {
			return &model.CommandResponse{
				ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
				Text:         fmt.Sprintf(translateFunc(model.REMIND_EXCEPTION_TEXT)),
			}
		}

		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text:         fmt.Sprintf("%s", response),
		}
	}

	return &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         fmt.Sprintf(translateFunc(model.REMIND_EXCEPTION_TEXT)),
	}

}
