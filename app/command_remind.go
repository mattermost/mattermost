// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)
type RemindProvider struct {
}

// TODO these need to be language handled
const (
	CMD_REMIND = "remind"
	ExceptionText = "Sorry, I didn’t quite get that. I’m easily confused. " +
		"Perhaps try the words in a different order? This usually works: " +
		"`/remind [@someone or ~channel] [what] [when]`.\n"
	HelpText = ":wave: Need some help with `/remind`?\n" +
		"Use `/remind` to set a reminder for yourself, someone else, or for a channel. Some examples include:\n" +
		"* `/remind me to drink water at 3pm every day`\n" +
		"* `/remind me on June 1st to wish Linda happy birthday`\n" +
		"* `/remind ~team-alpha to update the project status every Monday at 9am`\n" +
		"* `/remind @jessica about the interview in 3 hours`\n" +
		"* `/remind @peter tomorrow \"Please review the office seating plan\"`\n" +
		"Or, use `/remind list` to see the list of all your reminders.\n" +
		"Have a bug to report or a feature request?  [Submit your issue here](https://gitreports.com/issue/scottleedavis/mattermost-plugin-remind)."
)

func init() {
	RegisterCommandProvider(&RemindProvider{})
}

func (me *RemindProvider) GetTrigger() string {
	return CMD_REMIND
}

func (me *RemindProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:			CMD_REMIND,
		AutoComplete:  		true,
		AutoCompleteDesc:	T("api.command_remind.desc"),
		AutoCompleteHint: 	T("api.command_remind.hint"),
		DisplayName:		T("api.command_remind.name"),
	}
}

func (me *RemindProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {

	mlog.Debug("DoCommand")
	//get current user

	if strings.HasSuffix(args.Command, "help") {
		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text: fmt.Sprintf(HelpText),
		}
	}

	if strings.HasSuffix(args.Command, "list") {

		//TODO list reminders

		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text: fmt.Sprintf("todo"),
		}
	}

	if strings.HasSuffix(args.Command, "clear") {

		//TODO delete reminders

		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text:         fmt.Sprintf("Ok.  Deleted."),
		}
	}

	payload := strings.Trim(strings.Replace(args.Command, "/"+CMD_REMIND, "", -1), " ")

	if strings.HasPrefix(payload, "me") ||
		strings.HasPrefix(payload, "@") ||
		strings.HasPrefix(payload, "~") {

		//request := ReminderRequest{args.TeamId, user.Username, payload, Reminder{}}
		//response, err := p.ScheduleReminder(request)
		//p.emitStatusChange()
		response := ""

		//if err != nil {
		//	return &model.CommandResponse{
		//		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		//		Text:         fmt.Sprintf(ExceptionText),
		//	}
		//}

		return &model.CommandResponse{
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
			Text:         fmt.Sprintf("%s", response),
		}
	}

	return &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         fmt.Sprintf(ExceptionText),
	}

}
