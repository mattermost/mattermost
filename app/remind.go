// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

var running bool
var remindUser *model.User
var emptyTime time.Time
var supportedLocales []string

func (a *App) InitReminders() {

	user, err := a.GetUserByUsername(model.REMIND_BOTNAME)
	if err != nil {
		userNew := model.User{
			Email:    "-@-.-",
			Username: model.REMIND_BOTNAME,
			Password: model.NewId(),
		}

		user, err = a.CreateUserAsAdmin(&userNew)
		if err != nil {
			mlog.Error(err.Message)
		}

	}

	remindUser = user
	emptyTime = time.Time{}.AddDate(1, 1, 1)
	supportedLocales = []string{"en"}
}

func (a *App) StartReminders() {
	if !running {
		running = true
		a.runner()
	}
}

func (a *App) StopReminders() {
	running = false
}

func (a *App) runner() {

	go func() {
		<-time.NewTimer(time.Second).C
		if !running {
			return
		}
		a.triggerReminders()
		a.runner()
	}()
}

func (a *App) triggerReminders() {

	t := time.Now().Round(time.Second).Format(time.RFC3339)
	schan := a.Srv.Store.Remind().GetByTime(t)

	if result := <-schan; result.Err != nil {
		mlog.Error(result.Err.Message)
	} else {
		occurrences := result.Data.(model.Occurrences)

		if len(occurrences) == 0 {
			return
		}

		for _, occurrence := range occurrences {

			reminder := model.Reminder{}

			schan = a.Srv.Store.Remind().GetReminder(occurrence.ReminderId)
			if result := <-schan; result.Err != nil {
				continue
			} else {
				reminder = result.Data.(model.Reminder)
			}

			user, _, _, _, T := a.shared(reminder.UserId)

			if strings.HasPrefix(reminder.Target, "@") || strings.HasPrefix(reminder.Target, T("app.reminder.me")) {

				channel, cErr := a.GetOrCreateDirectChannel(remindUser.Id, user.Id)
				if cErr != nil {
					continue
				}

				finalTarget := reminder.Target
				if finalTarget == T("app.reminder.me") {
					finalTarget = T("app.reminder.you")
				} else {
					finalTarget = "@" + user.Username
				}

				var messageParameters = map[string]interface{}{
					"FinalTarget": finalTarget,
					"Message":     reminder.Message,
				}

				interactivePost := model.Post{
					ChannelId:     channel.Id,
					PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
					UserId:        remindUser.Id,
					Message:       T("app.reminder.message", messageParameters),
					Props: model.StringInterface{
						"attachments": []*model.SlackAttachment{
							{
								Actions: []*model.PostAction{
									{
										Integration: &model.PostActionIntegration{
											Context: model.StringInterface{
												"reminderId":   reminder.Id,
												"occurrenceId": occurrence.Id,
												"action":       "complete",
											},
											URL: "mattermost://remind",
										},
										Name: T("app.reminder.update.button.complete"),
										Type: "action",
									},
									{
										Integration: &model.PostActionIntegration{
											Context: model.StringInterface{
												"reminderId":   reminder.Id,
												"occurrenceId": occurrence.Id,
												"action":       "delete",
											},
											URL: "mattermost://remind",
										},
										Name: T("app.reminder.update.button.delete"),
										Type: "action",
									},
									{
										Integration: &model.PostActionIntegration{
											Context: model.StringInterface{
												"reminderId":   reminder.Id,
												"occurrenceId": occurrence.Id,
												"action":       "snooze",
											},
											URL: "mattermost://remind",
										},
										Name: T("app.reminder.update.button.snooze"),
										Type: "select",
										Options: []*model.PostActionOptions{
											{
												Text:  T("app.reminder.update.button.snooze.20min"),
												Value: "20min",
											},
											{
												Text:  T("app.reminder.update.button.snooze.1hr"),
												Value: "1hr",
											},
											{
												Text:  T("app.reminder.update.button.snooze.3hr"),
												Value: "3hrs",
											},
											{
												Text:  T("app.reminder.update.button.snooze.tomorrow"),
												Value: "tomorrow",
											},
											{
												Text:  T("app.reminder.update.button.snooze.nextweek"),
												Value: "nextweek",
											},
										},
									},
								},
							},
						},
					},
				}

				if _, pErr := a.CreatePostAsUser(&interactivePost, false); pErr != nil {
					mlog.Error(fmt.Sprintf("%v", pErr))
				}

				if occurrence.Repeat != "" {
					a.RescheduleOccurrence(&occurrence)
				}

			} else if strings.HasPrefix(reminder.Target, "~") {

				channel, cErr := a.GetChannelByName(
					strings.Replace(reminder.Target, "~", "", -1),
					reminder.TeamId,
					false,
				)

				if cErr != nil {
					mlog.Error(cErr.Message)
					continue
				}

				var messageParameters = map[string]interface{}{
					"FinalTarget": "@" + user.Username,
					"Message":     reminder.Message,
				}

				interactivePost := model.Post{
					ChannelId:     channel.Id,
					PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
					UserId:        remindUser.Id,
					Message:       T("app.reminder.message", messageParameters),
					Props:         model.StringInterface{},
				}

				if _, pErr := a.CreatePostAsUser(&interactivePost, false); pErr != nil {
					mlog.Error(fmt.Sprintf("%v", pErr))
				}

				if occurrence.Repeat != "" {
					a.RescheduleOccurrence(&occurrence)
				}

			}

		}

	}
}

func (a *App) UpdateReminder(post *model.Post, action *model.PostAction, userId string, selectedOption string) error {

	_, cfg, location, _, T := a.shared(userId)

	update := &model.Post{}
	update.Id = post.Id
	reminderId := action.Integration.Context["reminderId"].(string)

	switch action.Integration.Context["action"] {
	case "complete":

		if result := <-a.Srv.Store.Remind().GetReminder(reminderId); result.Err != nil {
			return result.Err
		} else {
			reminder := result.Data.(model.Reminder)
			reminder.Completed = time.Now().Format(time.RFC3339)
			if result := <-a.Srv.Store.Remind().SaveReminder(&reminder); result.Err != nil {
				return result.Err
			}
			if result := <-a.Srv.Store.Remind().DeleteForReminder(reminderId); result.Err != nil {
				return result.Err
			}
			var updateParameters = map[string]interface{}{
				"Message": reminder.Message,
			}
			update.Message = "~~" + post.Message + "~~\n" + T("app.reminder.update.complete", updateParameters)
		}

	case "delete":
		if result := <-a.Srv.Store.Remind().GetReminder(reminderId); result.Err != nil {
			return result.Err
		} else {
			reminder := result.Data.(model.Reminder)
			schan := a.Srv.Store.Remind().DeleteByReminder(reminderId)
			if result := <-schan; result.Err != nil {
				return result.Err
			}
			var deleteParameters = map[string]interface{}{
				"Message": reminder.Message,
			}
			update.Message = T("app.reminder.update.delete", deleteParameters)
		}

	case "snooze":
		occurrenceId := action.Integration.Context["occurrenceId"].(string)

		if result := <-a.Srv.Store.Remind().GetOccurrence(occurrenceId); result.Err != nil {
			return result.Err
		} else {
			occurrence := result.Data.(model.Occurrence)

			if result := <-a.Srv.Store.Remind().GetReminder(reminderId); result.Err != nil {
				return result.Err
			} else {
				reminder := result.Data.(model.Reminder)
				var snoozeParameters = map[string]interface{}{
					"Message": reminder.Message,
				}

				switch selectedOption {
				case "20min":

					if *cfg.DisplaySettings.ExperimentalTimezone {
						occurrence.Snoozed = time.Now().In(location).Round(time.Second).Add(time.Minute * time.Duration(20)).Format(time.RFC3339)
					} else {
						occurrence.Snoozed = time.Now().Round(time.Second).Add(time.Minute * time.Duration(20)).Format(time.RFC3339)
					}

					update.Message = T("app.reminder.update.snooze.20min", snoozeParameters)

				case "1hr":

					if *cfg.DisplaySettings.ExperimentalTimezone {
						occurrence.Snoozed = time.Now().In(location).Round(time.Second).Add(time.Hour * time.Duration(1)).Format(time.RFC3339)
					} else {
						occurrence.Snoozed = time.Now().Round(time.Second).Add(time.Hour * time.Duration(1)).Format(time.RFC3339)
					}
					update.Message = T("app.reminder.update.snooze.1hr", snoozeParameters)

				case "3hrs":

					if *cfg.DisplaySettings.ExperimentalTimezone {
						occurrence.Snoozed = time.Now().In(location).Round(time.Second).Add(time.Hour * time.Duration(3)).Format(time.RFC3339)
					} else {
						occurrence.Snoozed = time.Now().Round(time.Second).Add(time.Hour * time.Duration(3)).Format(time.RFC3339)
					}
					update.Message = T("app.reminder.update.snooze.3hr", snoozeParameters)

				case "tomorrow":

					if *cfg.DisplaySettings.ExperimentalTimezone {
						tt := time.Now().In(location).Add(time.Hour * time.Duration(24))
						occurrence.Snoozed = time.Date(tt.Year(), tt.Month(), tt.Day(), 9, 0, 0, 0, location).Format(time.RFC3339)
					} else {
						tt := time.Now().Add(time.Hour * time.Duration(24))
						occurrence.Snoozed = time.Date(tt.Year(), tt.Month(), tt.Day(), 9, 0, 0, 0, time.Local).Format(time.RFC3339)
					}
					update.Message = T("app.reminder.update.snooze.tomorrow", snoozeParameters)

				case "nextweek":

					todayWeekDayNum := int(time.Now().Weekday())
					weekDayNum := 1
					day := 0

					if weekDayNum < todayWeekDayNum {
						day = 7 - (todayWeekDayNum - weekDayNum)
					} else if weekDayNum >= todayWeekDayNum {
						day = 7 + (weekDayNum - todayWeekDayNum)
					}

					tt := time.Now()
					if *cfg.DisplaySettings.ExperimentalTimezone {
						occurrence.Snoozed = time.Date(tt.Year(), tt.Month(), tt.Day(), 9, 0, 0, 0, location).AddDate(0, 0, day).Format(time.RFC3339)
					} else {
						occurrence.Snoozed = time.Date(tt.Year(), tt.Month(), tt.Day(), 9, 0, 0, 0, time.Local).AddDate(0, 0, day).Format(time.RFC3339)
					}

					update.Message = T("app.reminder.update.snooze.nextweek", snoozeParameters)

				}

				schan := a.Srv.Store.Remind().SaveOccurrence(&occurrence)
				if result := <-schan; result.Err != nil {
					return result.Err
				}
			}
		}
	}

	if _, err := a.UpdatePost(update, false); err != nil {
		return err
	}

	return nil

}

func (a *App) ListReminders(userId string, channelId string) string {

	_, _, _, _, T := a.shared(userId)

	var upcomingOccurrences []model.Occurrence
	var recurringOccurrences []model.Occurrence
	var pastOccurrences []model.Occurrence
	var channelOccurrences []model.Occurrence

	reminders := a.getReminders(userId)

	output := ""

	for _, reminder := range reminders {

		schan := a.Srv.Store.Remind().GetByReminder(reminder.Id)
		result := <-schan
		if result.Err != nil {
			continue
		}

		occurrences := result.Data.(model.Occurrences)

		if len(occurrences) > 0 {

			for _, occurrence := range occurrences {

				t, pErr := time.Parse(time.RFC3339, occurrence.Occurrence)
				s, pErr2 := time.Parse(time.RFC3339, occurrence.Snoozed)
				if pErr != nil || pErr2 != nil {
					continue
				}

				if !strings.HasPrefix(reminder.Target, "~") &&
					reminder.Completed == emptyTime.Format(time.RFC3339) &&
					(occurrence.Repeat == "" && t.After(time.Now())) ||
					(s != emptyTime && s.After(time.Now())) {
					upcomingOccurrences = append(upcomingOccurrences, occurrence)
				}

				if !strings.HasPrefix(reminder.Target, "~") &&
					occurrence.Repeat != "" && (t.After(time.Now()) ||
					(s != emptyTime && s.After(time.Now()))) {
					recurringOccurrences = append(recurringOccurrences, occurrence)
				}

				if !strings.HasPrefix(reminder.Target, "~") &&
					reminder.Completed == emptyTime.Format(time.RFC3339) &&
					t.Before(time.Now()) &&
					s == emptyTime {
					pastOccurrences = append(pastOccurrences, occurrence)
				}

				if strings.HasPrefix(reminder.Target, "~") &&
					reminder.Completed == emptyTime.Format(time.RFC3339) &&
					t.After(time.Now()) {
					channelOccurrences = append(channelOccurrences, occurrence)
				}

			}

		}

	}

	channel, _ := a.GetChannel(channelId)
	schan := a.Srv.Store.Remind().GetByChannel("~" + channel.Name)
	result := <-schan

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	} else {
		inChannel := result.Data.(model.ChannelReminders)

		if len(inChannel.Occurrences) > 0 {
			output = strings.Join([]string{
				output,
				T("app.reminder.list_inchannel"),
				a.listReminderGroup(userId, &inChannel.Occurrences, &reminders, "inchannel"),
				"\n",
			}, "\n")
		}
	}

	if len(upcomingOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			T("app.reminder.list_upcoming"),
			a.listReminderGroup(userId, &upcomingOccurrences, &reminders, "upcoming"),
			"\n",
		}, "\n")
	}

	if len(recurringOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			T("app.reminder.list_recurring"),
			a.listReminderGroup(userId, &recurringOccurrences, &reminders, "recurring"),
			"\n",
		}, "\n")
	}

	if len(pastOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			T("app.reminder.list_past_and_incomplete"),
			a.listReminderGroup(userId, &pastOccurrences, &reminders, "past"),
			"\n",
		}, "\n")
	}

	if len(channelOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			T("app.reminder.list_channel"),
			a.listReminderGroup(userId, &channelOccurrences, &reminders, "channel"),
			"\n",
		}, "\n")
	}

	return output + T("app.reminder.list_footer")
}

func (a *App) listReminderGroup(userId string, occurrences *[]model.Occurrence, reminders *[]model.Reminder, gType string) string {

	_, cfg, location, _, T := a.shared(userId)

	var output string
	output = ""

	for _, occurrence := range *occurrences {

		reminder := a.findReminder(occurrence.ReminderId, reminders)
		t, pErr := time.Parse(time.RFC3339, occurrence.Occurrence)
		s, pErr2 := time.Parse(time.RFC3339, occurrence.Snoozed)
		if pErr != nil || pErr2 != nil {
			continue
		}

		var formattedOccurrence string
		if *cfg.DisplaySettings.ExperimentalTimezone {
			formattedOccurrence = a.formatWhen(userId, reminder.When, t.In(location).Format(time.RFC3339), false)

		} else {
			formattedOccurrence = a.formatWhen(userId, reminder.When, t.Format(time.RFC3339), false)
		}

		formattedSnooze := ""
		if s != emptyTime {
			if *cfg.DisplaySettings.ExperimentalTimezone {
				formattedSnooze = a.formatWhen(userId, reminder.When, s.In(location).Format(time.RFC3339), true)
			} else {
				formattedSnooze = a.formatWhen(userId, reminder.When, s.Format(time.RFC3339), true)
			}
		}

		var messageParameters = map[string]interface{}{
			"Message":    reminder.Message,
			"Occurrence": formattedOccurrence,
			"Snoozed":    formattedSnooze,
		}
		if !t.Equal(emptyTime) {
			switch gType {
			case "upcoming":
				if formattedSnooze == "" {
					output = strings.Join([]string{output, T("app.reminder.list.element.upcoming", messageParameters)}, "\n")
				} else {
					output = strings.Join([]string{output, T("app.reminder.list.element.upcoming.snoozed", messageParameters)}, "\n")
				}
			case "recurring":
				if formattedSnooze == "" {
					output = strings.Join([]string{output, T("app.reminder.list.element.recurring", messageParameters)}, "\n")
				} else {
					output = strings.Join([]string{output, T("app.reminder.list.element.recurring.snoozed", messageParameters)}, "\n")
				}
			case "past":
				output = strings.Join([]string{output, T("app.reminder.list.element.past", messageParameters)}, "\n")
			case "channel":
				output = strings.Join([]string{output, T("app.reminder.list.element.channel", messageParameters)}, "\n")
			case "inchannel":
				output = strings.Join([]string{output, T("app.reminder.list.element.inchannel", messageParameters)}, "\n")
			}
		}
	}
	return output
}

func (a *App) findReminder(reminderId string, reminders *[]model.Reminder) *model.Reminder {
	for _, reminder := range *reminders {
		if reminder.Id == reminderId {
			return &reminder
		}
	}
	return &model.Reminder{}
}

func (a *App) DeleteReminders(userId string) string {

	_, _, _, _, T := a.shared(userId)

	schan := a.Srv.Store.Remind().DeleteForUser(userId)
	if result := <-schan; result.Err != nil {
		return ""
	}
	return T("app.reminder.ok_deleted")
}

func (a *App) getReminders(userId string) []model.Reminder {

	schan := a.Srv.Store.Remind().GetByUser(userId)
	if result := <-schan; result.Err != nil {
		return []model.Reminder{}
	} else {
		return result.Data.(model.Reminders)
	}
}

func (a *App) ScheduleReminder(request *model.ReminderRequest) (string, error) {

	_, _, _, _, T := a.shared(request.UserId)

	if pErr := a.parseRequest(request); pErr != nil {
		mlog.Error(pErr.Error())
		return T(model.REMIND_EXCEPTION_TEXT), nil
	}

	useTo := strings.HasPrefix(request.Reminder.Message, T("app.reminder.chrono.to"))
	var useToString string
	if useTo {
		useToString = " " + T("app.reminder.chrono.to")
	} else {
		useToString = ""
	}

	request.Reminder.Id = model.NewId()
	request.Reminder.TeamId = request.TeamId
	request.Reminder.UserId = request.UserId
	request.Reminder.Completed = emptyTime.Format(time.RFC3339)

	if cErr := a.createOccurrences(request); cErr != nil {
		mlog.Error(cErr.Error())
		return T(model.REMIND_EXCEPTION_TEXT), nil
	}

	schan := a.Srv.Store.Remind().SaveReminder(&request.Reminder)
	if result := <-schan; result.Err != nil {
		mlog.Error(result.Err.Message)
		return T(model.REMIND_EXCEPTION_TEXT), nil
	}

	if request.Reminder.Target == T("app.reminder.me") {
		request.Reminder.Target = T("app.reminder.you")
	}

	var responseParameters = map[string]interface{}{
		"Target":  request.Reminder.Target,
		"UseTo":   useToString,
		"Message": request.Reminder.Message,
		"When":    a.formatWhen(request.UserId, request.Reminder.When, request.Occurrences[0].Occurrence, false),
	}
	response := T("app.reminder.response", responseParameters)

	return response, nil
}

func (a *App) RescheduleOccurrence(occurrence *model.Occurrence) {

	user, _, _, _, T := a.shared(occurrence.UserId)
	var times []time.Time

	if strings.HasPrefix(occurrence.Repeat, T("app.reminder.chrono.in")) {
		times, _ = a.in(occurrence.Repeat, user)
	} else if strings.HasPrefix(occurrence.Repeat, T("app.reminder.chrono.at")) {
		times, _ = a.at(occurrence.Repeat, user)
	} else if strings.HasPrefix(occurrence.Repeat, T("app.reminder.chrono.on")) {
		times, _ = a.on(occurrence.Repeat, user)
	} else if strings.HasPrefix(occurrence.Repeat, T("app.reminder.chrono.every")) {
		times, _ = a.every(occurrence.Repeat, user)
	} else {
		times, _ = a.freeForm(occurrence.Repeat, user)
	}

	if len(times) > 1 {

		td, _ := time.Parse(time.RFC3339, occurrence.Occurrence)
		for _, ts := range times {
			if ts.Weekday() == td.Weekday() {

				occurrence.Occurrence = ts.Format(time.RFC3339)
				schan := a.Srv.Store.Remind().SaveOccurrence(occurrence)
				if result := <-schan; result.Err != nil {
					mlog.Error("error: " + result.Err.Message)
				}
				return
			}
		}

	} else {

		occurrence.Occurrence = times[0].Format(time.RFC3339)
		schan := a.Srv.Store.Remind().SaveOccurrence(occurrence)
		if result := <-schan; result.Err != nil {
			mlog.Error("error: " + result.Err.Message)
		}

	}

}

func (a *App) formatWhen(userId string, when string, occurrence string, snoozed bool) string {

	user, _, _, _, T := a.shared(userId)

	if strings.HasPrefix(when, T("app.reminder.chrono.in")) {

		t, _ := time.Parse(time.RFC3339, occurrence)
		endDate := ""
		if time.Now().YearDay() == t.YearDay() {
			endDate = T("app.reminder.chrono.today")
		} else if time.Now().YearDay() == t.YearDay()-1 {
			endDate = T("app.reminder.chrono.tomorrow")
		} else {
			endDate = t.Weekday().String() + ", " + t.Month().String() + " " + a.daySuffixFromInt(user, t.Day())
		}
		prefix := ""
		if !snoozed {
			prefix = when + " " + T("app.reminder.chrono.at") + " "
		}
		return prefix + t.Format(time.Kitchen) + " " + endDate + "."
	}

	if strings.HasPrefix(when, T("app.reminder.chrono.at")) {

		t, _ := time.Parse(time.RFC3339, occurrence)
		endDate := ""
		if time.Now().YearDay() == t.YearDay() {
			endDate = T("app.reminder.chrono.today")
		} else if time.Now().YearDay() == t.YearDay()-1 {
			endDate = T("app.reminder.chrono.tomorrow")
		} else {
			endDate = t.Weekday().String() + ", " + t.Month().String() + " " + a.daySuffixFromInt(user, t.Day())
		}
		prefix := ""
		if !snoozed {
			prefix = T("app.reminder.chrono.at") + " "
		}
		return prefix + t.Format(time.Kitchen) + " " + endDate + "."

	}

	if strings.HasPrefix(when, T("app.reminder.chrono.on")) {

		t, _ := time.Parse(time.RFC3339, occurrence)
		endDate := ""
		if time.Now().YearDay() == t.YearDay() {
			endDate = T("app.reminder.chrono.today")
		} else if time.Now().YearDay() == t.YearDay()-1 {
			endDate = T("app.reminder.chrono.tomorrow")
		} else {
			endDate = t.Weekday().String() + ", " + t.Month().String() + " " + a.daySuffixFromInt(user, t.Day())
		}
		prefix := ""
		if !snoozed {
			prefix = T("app.reminder.chrono.at") + " "
		}
		return prefix + t.Format(time.Kitchen) + " " + endDate + "."

	}

	if strings.HasPrefix(when, T("app.reminder.chrono.every")) {

		t, _ := time.Parse(time.RFC3339, occurrence)
		repeatDate := strings.Trim(strings.Split(when, T("app.reminder.chrono.at"))[0], " ")
		repeatDate = strings.Replace(repeatDate, T("app.reminder.chrono.every"), "", -1)
		repeatDate = strings.Title(strings.ToLower(repeatDate))
		repeatDate = T("app.reminder.chrono.every") + repeatDate
		prefix := ""
		if !snoozed {
			prefix = T("app.reminder.chrono.at") + " "
		}
		return prefix + t.Format(time.Kitchen) + " " + repeatDate + "."

	}

	t, _ := time.Parse(time.RFC3339, occurrence)
	endDate := ""
	if time.Now().YearDay() == t.YearDay() {
		endDate = T("app.reminder.chrono.today")
	} else if time.Now().YearDay() == t.YearDay()-1 {
		endDate = T("app.reminder.chrono.tomorrow")
	} else {
		endDate = t.Weekday().String() + ", " + t.Month().String() + " " + a.daySuffixFromInt(user, t.Day())
	}
	prefix := ""
	if !snoozed {
		prefix = T("app.reminder.chrono.at") + " "
	}
	return prefix + t.Format(time.Kitchen) + " " + endDate + "."

}

func (a *App) parseRequest(request *model.ReminderRequest) error {

	_, _, _, _, T := a.shared(request.UserId)

	commandSplit := strings.Split(request.Payload, " ")

	if strings.HasPrefix(request.Payload, T("app.reminder.me")) ||
		strings.HasPrefix(request.Payload, "~") ||
		strings.HasPrefix(request.Payload, "@") {

		request.Reminder.Target = commandSplit[0]

		firstIndex := strings.Index(request.Payload, "\"")
		lastIndex := strings.LastIndex(request.Payload, "\"")

		if firstIndex > -1 && lastIndex > -1 && firstIndex != lastIndex { // has quotes

			message := request.Payload[firstIndex : lastIndex+1]

			when := strings.Replace(request.Payload, message, "", -1)
			when = strings.Replace(when, commandSplit[0], "", -1)
			when = strings.Trim(when, " ")

			message = strings.Replace(message, "\"", "", -1)

			request.Reminder.When = when
			request.Reminder.Message = message
			return nil
		}

		if wErr := a.findWhen(request); wErr != nil {
			return wErr
		}

		message := strings.Replace(request.Payload, request.Reminder.When, "", -1)
		message = strings.Replace(message, commandSplit[0], "", -1)
		message = strings.Trim(message, " \"")

		request.Reminder.Message = message

		return nil

	}

	return errors.New("unrecognized target")
}

func (a *App) createOccurrences(request *model.ReminderRequest) error {

	user, _, _, _, T := a.shared(request.UserId)

	if strings.HasPrefix(request.Reminder.When, T("app.reminder.chrono.in")) {
		if occurrences, inErr := a.in(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, T("app.reminder.chrono.at")) {
		if occurrences, inErr := a.at(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, T("app.reminder.chrono.on")) {
		if occurrences, inErr := a.on(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, T("app.reminder.chrono.every")) {
		if occurrences, inErr := a.every(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if occurrences, freeErr := a.freeForm(request.Reminder.When, user); freeErr != nil {
		return freeErr
	} else {
		return a.addOccurrences(request, occurrences)
	}

}

func (a *App) addOccurrences(request *model.ReminderRequest, occurrences []time.Time) error {

	_, _, _, _, T := a.shared(request.UserId)

	for _, o := range occurrences {

		repeat := ""

		if a.isRepeating(request) {
			repeat = request.Reminder.When
			if strings.HasPrefix(request.Reminder.Target, "@") &&
				request.Reminder.Target != T("app.reminder.me") {

				rUser, _ := a.GetUser(request.UserId)

				if tUser, tErr := a.GetUserByUsername(request.Reminder.Target[1:]); tErr != nil {
					return tErr
				} else {
					if rUser.Id != tUser.Id {
						return errors.New("repeating reminders for another user not permitted")
					}
				}

			}
		}

		occurrence := &model.Occurrence{
			Id:         model.NewId(),
			UserId:     request.UserId,
			ReminderId: request.Reminder.Id,
			Repeat:     repeat,
			Occurrence: o.Format(time.RFC3339),
			Snoozed:    emptyTime.Format(time.RFC3339),
		}

		schan := a.Srv.Store.Remind().SaveOccurrence(occurrence)
		if result := <-schan; result.Err != nil {
			mlog.Error("error: " + result.Err.Message)
			return result.Err
		}

		request.Occurrences = append(request.Occurrences, *occurrence)

	}

	return nil
}

func (a *App) isRepeating(request *model.ReminderRequest) bool {

	_, _, _, _, T := a.shared(request.UserId)

	return strings.Contains(request.Reminder.When, T("app.reminder.chrono.every")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.sundays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.mondays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.tuesdays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.wednesdays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.thursdays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.fridays")) ||
		strings.Contains(request.Reminder.When, T("app.reminder.chrono.saturdays"))

}

func (a *App) findWhen(request *model.ReminderRequest) error {

	user, _, _, _, T := a.shared(request.UserId)

	inIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.in")+" ")
	if inIndex > -1 {
		request.Reminder.When = strings.Trim(request.Payload[inIndex:], " ")
		return nil
	}

	everyIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.every")+" ")
	atIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (everyIndex > -1 && atIndex == -1) || (atIndex > everyIndex) && everyIndex != -1 {
		request.Reminder.When = strings.Trim(request.Payload[everyIndex:], " ")
		return nil
	}

	onIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.on")+" ")
	if onIndex > -1 {
		request.Reminder.When = strings.Trim(request.Payload[onIndex:], " ")
		return nil
	}

	everydayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.everyday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (everydayIndex > -1 && atIndex >= -1) && (atIndex > everydayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[everydayIndex:], " ")
		return nil
	}

	todayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.today")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (todayIndex > -1 && atIndex >= -1) && (atIndex > todayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[todayIndex:], " ")
		return nil
	}

	tomorrowIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.tomorrow")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (tomorrowIndex > -1 && atIndex >= -1) && (atIndex > tomorrowIndex) {
		request.Reminder.When = strings.Trim(request.Payload[tomorrowIndex:], " ")
		return nil
	}

	mondayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.monday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (mondayIndex > -1 && atIndex >= -1) && (atIndex > mondayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[mondayIndex:], " ")
		return nil
	}

	tuesdayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.tuesday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (tuesdayIndex > -1 && atIndex >= -1) && (atIndex > tuesdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[tuesdayIndex:], " ")
		return nil
	}

	wednesdayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.wednesday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (wednesdayIndex > -1 && atIndex >= -1) && (atIndex > wednesdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[wednesdayIndex:], " ")
		return nil
	}

	thursdayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.thursday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (thursdayIndex > -1 && atIndex >= -1) && (atIndex > thursdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[thursdayIndex:], " ")
		return nil
	}

	fridayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.friday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (fridayIndex > -1 && atIndex >= -1) && (atIndex > fridayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[fridayIndex:], " ")
		return nil
	}

	saturdayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.saturday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (saturdayIndex > -1 && atIndex >= -1) && (atIndex > saturdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[saturdayIndex:], " ")
		return nil
	}

	sundayIndex := strings.Index(request.Payload, " "+T("app.reminder.chrono.sunday")+" ")
	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	if (sundayIndex > -1 && atIndex >= -1) && (atIndex > sundayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[sundayIndex:], " ")
		return nil
	}

	atIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.at")+" ")
	everyIndex = strings.Index(request.Payload, " "+T("app.reminder.chrono.every")+" ")
	if (atIndex > -1 && everyIndex >= -1) || (everyIndex > atIndex) && atIndex != -1 {
		request.Reminder.When = strings.Trim(request.Payload[atIndex:], " ")
		return nil
	}

	textSplit := strings.Split(request.Payload, " ")

	if len(textSplit) == 1 {
		request.Reminder.When = textSplit[0]
		return nil
	}

	lastWord := textSplit[len(textSplit)-2] + " " + textSplit[len(textSplit)-1]
	_, dErr := a.normalizeDate(lastWord, user)
	if dErr == nil {
		request.Reminder.When = lastWord
		return nil
	} else {
		lastWord = textSplit[len(textSplit)-1]

		switch lastWord {
		case T("app.reminder.chrono.tomorrow"):
			request.Reminder.When = lastWord
			return nil
		case T("app.reminder.chrono.everyday"),
			T("app.reminder.chrono.mondays"),
			T("app.reminder.chrono.tuesdays"),
			T("app.reminder.chrono.wednesdays"),
			T("app.reminder.chrono.thursdays"),
			T("app.reminder.chrono.fridays"),
			T("app.reminder.chrono.saturdays"),
			T("app.reminder.chrono.sundays"):
			request.Reminder.When = lastWord
		default:
			break
		}

		_, dErr = a.normalizeDate(lastWord, user)
		if dErr == nil {
			request.Reminder.When = lastWord
			return nil
		} else {
			if len(textSplit) < 3 {
				return errors.New("unable to find when")
			}
			var firstWord string
			switch textSplit[1] {
			case T("app.reminder.chrono.at"):
				firstWord = textSplit[2]
				request.Reminder.When = textSplit[1] + " " + firstWord
				return nil
			case T("app.reminder.chrono.in"),
				T("app.reminder.chrono.on"):
				if len(textSplit) < 4 {
					return errors.New("unable to find when")
				}
				firstWord = textSplit[2] + " " + textSplit[3]
				request.Reminder.When = textSplit[1] + " " + firstWord
				return nil
			case T("app.reminder.chrono.tomorrow"),
				T("app.reminder.chrono.monday"),
				T("app.reminder.chrono.tuesday"),
				T("app.reminder.chrono.wednesday"),
				T("app.reminder.chrono.thursday"),
				T("app.reminder.chrono.friday"),
				T("app.reminder.chrono.saturday"),
				T("app.reminder.chrono.sunday"):
				firstWord = textSplit[1]
				request.Reminder.When = firstWord
				return nil
			default:
				break
			}
		}

	}

	return errors.New("unable to find when")
}

func (a *App) in(when string, user *model.User) (times []time.Time, err error) {

	_, cfg, location, _, T := a.shared(user.Id)

	whenSplit := strings.Split(when, " ")
	value := whenSplit[1]
	units := whenSplit[len(whenSplit)-1]

	switch units {
	case T("app.reminder.chrono.seconds"),
		T("app.reminder.chrono.second"),
		T("app.reminder.chrono.secs"),
		T("app.reminder.chrono.sec"),
		T("app.reminder.chrono.s"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Second*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Second*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.minutes"),
		T("app.reminder.chrono.minute"),
		T("app.reminder.chrono.min"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Minute*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Minute*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.hours"),
		T("app.reminder.chrono.hour"),
		T("app.reminder.chrono.hrs"),
		T("app.reminder.chrono.hr"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.days"),
		T("app.reminder.chrono.day"),
		T("app.reminder.chrono.d"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*24*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*24*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.weeks"),
		T("app.reminder.chrono.week"),
		T("app.reminder.chrono.wks"),
		T("app.reminder.chrono.wk"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*24*7*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*24*7*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.months"),
		T("app.reminder.chrono.month"),
		T("app.reminder.chrono.m"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*24*30*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*24*30*time.Duration(i)))
		}

		return times, nil

	case T("app.reminder.chrono.years"),
		T("app.reminder.chrono.year"),
		T("app.reminder.chrono.yr"),
		T("app.reminder.chrono.y"):

		i, e := strconv.Atoi(value)

		if e != nil {
			num, wErr := a.wordToNumber(value, user)
			if wErr != nil {
				mlog.Error(fmt.Sprintf("%v", wErr))
				return []time.Time{}, wErr
			}
			i = num
		}

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*24*30*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*24*365*time.Duration(i)))
		}

		return times, nil

	default:
		return nil, errors.New("could not format 'in'")
	}

}

func (a *App) at(when string, user *model.User) (times []time.Time, err error) {

	T, _ := a.translation(user)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")
	normalizedWhen := strings.ToLower(whenSplit[1])

	if strings.Contains(when, T("app.reminder.chrono.every")) {

		dateTimeSplit := strings.Split(when, " "+T("app.reminder.chrono.every")+" ")
		return a.every(T("app.reminder.chrono.every")+" "+dateTimeSplit[1]+" "+dateTimeSplit[0], user)

	} else if len(whenSplit) >= 3 &&
		(strings.EqualFold(whenSplit[2], T("app.reminder.chrono.pm")) ||
			strings.EqualFold(whenSplit[2], T("app.reminder.chrono.am"))) {

		if !strings.Contains(normalizedWhen, ":") {
			if len(normalizedWhen) >= 3 {
				hrs := string(normalizedWhen[:len(normalizedWhen)-2])
				mins := string(normalizedWhen[len(normalizedWhen)-2:])
				normalizedWhen = hrs + ":" + mins
			} else {
				normalizedWhen = normalizedWhen + ":00"
			}
		}
		t, pErr := time.Parse(time.Kitchen, normalizedWhen+strings.ToUpper(whenSplit[2]))
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
		}

		now := time.Now().Round(time.Hour * time.Duration(24))
		occurrence := t.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &occurrence, true)}, nil

	} else if strings.HasSuffix(normalizedWhen, T("app.reminder.chrono.pm")) ||
		strings.HasSuffix(normalizedWhen, T("app.reminder.chrono.am")) {

		if !strings.Contains(normalizedWhen, ":") {
			var s string
			var s2 string
			if len(normalizedWhen) == 3 {
				s = normalizedWhen[:len(normalizedWhen)-2]
				s2 = normalizedWhen[len(normalizedWhen)-2:]
			} else if len(normalizedWhen) >= 4 {
				s = normalizedWhen[:len(normalizedWhen)-4]
				s2 = normalizedWhen[len(normalizedWhen)-4:]
			}

			if len(s2) > 2 {
				normalizedWhen = s + ":" + s2
			} else {
				normalizedWhen = s + ":00" + s2
			}

		}
		t, pErr := time.Parse(time.Kitchen, strings.ToUpper(normalizedWhen))
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
		}

		now := time.Now().Round(time.Hour * time.Duration(24))
		occurrence := t.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &occurrence, true)}, nil

	}

	switch normalizedWhen {

	case T("app.reminder.chrono.noon"):

		now := time.Now()

		noon, pErr := time.Parse(time.Kitchen, "12:00PM")
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
			return []time.Time{}, pErr
		}

		noon = noon.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &noon, true)}, nil

	case T("app.reminder.chrono.midnight"):

		now := time.Now()

		midnight, pErr := time.Parse(time.Kitchen, "12:00AM")
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
			return []time.Time{}, pErr
		}

		midnight = midnight.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &midnight, true)}, nil

	case T("app.reminder.chrono.one"),
		T("app.reminder.chrono.two"),
		T("app.reminder.chrono.three"),
		T("app.reminder.chrono.four"),
		T("app.reminder.chrono.five"),
		T("app.reminder.chrono.six"),
		T("app.reminder.chrono.seven"),
		T("app.reminder.chrono.eight"),
		T("app.reminder.chrono.nine"),
		T("app.reminder.chrono.ten"),
		T("app.reminder.chrono.eleven"),
		T("app.reminder.chrono.twelve"):

		nowkit := time.Now().Format(time.Kitchen)
		ampm := string(nowkit[len(nowkit)-2:])

		num, wErr := a.wordToNumber(normalizedWhen, user)
		if wErr != nil {
			return []time.Time{}, wErr
		}

		wordTime, _ := time.Parse(time.Kitchen, strconv.Itoa(num)+":00"+ampm)
		return []time.Time{a.chooseClosest(user, &wordTime, false)}, nil

	case T("app.reminder.chrono.0"),
		T("app.reminder.chrono.1"),
		T("app.reminder.chrono.2"),
		T("app.reminder.chrono.3"),
		T("app.reminder.chrono.4"),
		T("app.reminder.chrono.5"),
		T("app.reminder.chrono.6"),
		T("app.reminder.chrono.7"),
		T("app.reminder.chrono.8"),
		T("app.reminder.chrono.9"),
		T("app.reminder.chrono.10"),
		T("app.reminder.chrono.11"),
		T("app.reminder.chrono.12"):

		nowkit := time.Now().Format(time.Kitchen)
		ampm := string(nowkit[len(nowkit)-2:])

		num, wErr := strconv.Atoi(normalizedWhen)
		if wErr != nil {
			return []time.Time{}, wErr
		}

		wordTime, _ := time.Parse(time.Kitchen, strconv.Itoa(num)+":00"+ampm)
		return []time.Time{a.chooseClosest(user, &wordTime, false)}, nil

	default:

		if !strings.Contains(normalizedWhen, ":") && len(normalizedWhen) >= 3 {
			s := normalizedWhen[:len(normalizedWhen)-2]
			normalizedWhen = s + ":" + normalizedWhen[len(normalizedWhen)-2:]
		}

		timeSplit := strings.Split(normalizedWhen, ":")
		hr, _ := strconv.Atoi(timeSplit[0])
		ampm := T("app.reminder.chrono.am")
		dayInterval := false

		if hr > 11 {
			ampm = T("app.reminder.chrono.pm")
		}
		if hr > 12 {
			hr -= 12
			dayInterval = true
			timeSplit[0] = strconv.Itoa(hr)
			normalizedWhen = strings.Join(timeSplit, ":")
		}

		t, pErr := time.Parse(time.Kitchen, strings.ToUpper(normalizedWhen+ampm))
		if pErr != nil {
			return []time.Time{}, pErr
		}

		now := time.Now().Round(time.Hour * time.Duration(24))
		occurrence := t.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &occurrence, dayInterval)}, nil

	}

}

func (a *App) on(when string, user *model.User) (times []time.Time, err error) {

	T, _ := a.translation(user)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")

	if len(whenSplit) < 2 {
		return []time.Time{}, errors.New("not enough arguments")
	}

	chronoUnit := strings.ToLower(strings.Join(whenSplit[1:], " "))
	dateTimeSplit := strings.Split(chronoUnit, " "+T("app.reminder.chrono.at")+" ")
	chronoDate := dateTimeSplit[0]
	chronoTime := model.DEFAULT_TIME
	if len(dateTimeSplit) > 1 {
		chronoTime = dateTimeSplit[1]
	}

	dateUnit, ndErr := a.normalizeDate(chronoDate, user)
	if ndErr != nil {
		return []time.Time{}, ndErr
	}
	timeUnit, ntErr := a.normalizeTime(chronoTime, user)
	if ntErr != nil {
		return []time.Time{}, ntErr
	}

	switch dateUnit {
	case T("app.reminder.chrono.sunday"),
		T("app.reminder.chrono.monday"),
		T("app.reminder.chrono.tuesday"),
		T("app.reminder.chrono.wednesday"),
		T("app.reminder.chrono.thursday"),
		T("app.reminder.chrono.friday"),
		T("app.reminder.chrono.saturday"):

		todayWeekDayNum := int(time.Now().Weekday())
		weekDayNum := a.weekDayNumber(dateUnit, user)
		day := 0

		if weekDayNum < todayWeekDayNum {
			day = 7 - (todayWeekDayNum - weekDayNum)
		} else if weekDayNum >= todayWeekDayNum {
			day = 7 + (weekDayNum - todayWeekDayNum)
		}

		timeUnitSplit := strings.Split(timeUnit, ":")
		hr, _ := strconv.Atoi(timeUnitSplit[0])
		ampm := strings.ToUpper(T("app.reminder.chrono.am"))

		if hr > 11 {
			ampm = strings.ToUpper(T("app.reminder.chrono.pm"))
		}
		if hr > 12 {
			hr -= 12
			timeUnitSplit[0] = strconv.Itoa(hr)
		}

		timeUnit = timeUnitSplit[0] + ":" + timeUnitSplit[1] + ampm
		wallClock, pErr := time.Parse(time.Kitchen, timeUnit)
		if pErr != nil {
			return []time.Time{}, pErr
		}

		nextDay := time.Now().AddDate(0, 0, day)
		occurrence := wallClock.AddDate(nextDay.Year(), int(nextDay.Month())-1, nextDay.Day()-1)

		return []time.Time{a.chooseClosest(user, &occurrence, false)}, nil

	case T("app.reminder.chrono.mondays"),
		T("app.reminder.chrono.tuesdays"),
		T("app.reminder.chrono.wednesdays"),
		T("app.reminder.chrono.thursdays"),
		T("app.reminder.chrono.fridays"),
		T("app.reminder.chrono.saturdays"),
		T("app.reminder.chrono.sundays"):

		return a.every(
			T("app.reminder.chrono.every")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit[:len(timeUnit)-3],
			user)

	}

	dateSplit := a.regSplit(dateUnit, "T|Z")

	if len(dateSplit) < 3 {
		timeSplit := strings.Split(dateSplit[1], "-")
		t, tErr := time.Parse(time.RFC3339, dateSplit[0]+"T"+timeUnit+"-"+timeSplit[1])
		if tErr != nil {
			return []time.Time{}, tErr
		}
		return []time.Time{t}, nil
	} else {
		t, tErr := time.Parse(time.RFC3339, dateSplit[0]+"T"+timeUnit+"Z"+dateSplit[2])
		if tErr != nil {
			return []time.Time{}, tErr
		}
		return []time.Time{t}, nil
	}

}

func (a *App) every(when string, user *model.User) (times []time.Time, err error) {

	T, _ := a.translation(user)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")

	if len(whenSplit) < 2 {
		return []time.Time{}, errors.New("not enough arguments")
	}

	var everyOther bool
	chronoUnit := strings.ToLower(strings.Join(whenSplit[1:], " "))
	otherSplit := strings.Split(chronoUnit, T("app.reminder.chrono.other"))
	if len(otherSplit) == 2 {
		chronoUnit = strings.Trim(otherSplit[1], " ")
		everyOther = true
	}
	dateTimeSplit := strings.Split(chronoUnit, " "+T("app.reminder.chrono.at")+" ")
	chronoDate := dateTimeSplit[0]
	chronoTime := model.DEFAULT_TIME
	if len(dateTimeSplit) > 1 {
		chronoTime = strings.Trim(dateTimeSplit[1], " ")
	}

	days := a.regSplit(chronoDate, "("+T("app.reminder.and")+")|(,)")

	for _, chrono := range days {

		dateUnit, ndErr := a.normalizeDate(strings.Trim(chrono, " "), user)
		if ndErr != nil {
			return []time.Time{}, ndErr
		}
		timeUnit, ntErr := a.normalizeTime(chronoTime, user)
		if ntErr != nil {
			return []time.Time{}, ntErr
		}

		switch dateUnit {
		case T("app.reminder.chrono.day"):
			d := 1
			if everyOther {
				d = 2
			}

			timeUnitSplit := strings.Split(timeUnit, ":")
			hr, _ := strconv.Atoi(timeUnitSplit[0])
			ampm := strings.ToUpper(T("app.reminder.chrono.am"))

			if hr > 11 {
				ampm = strings.ToUpper(T("app.reminder.chrono.pm"))
			}
			if hr > 12 {
				hr -= 12
				timeUnitSplit[0] = strconv.Itoa(hr)
			}

			timeUnit = timeUnitSplit[0] + ":" + timeUnitSplit[1] + ampm
			wallClock, pErr := time.Parse(time.Kitchen, timeUnit)
			if pErr != nil {
				return []time.Time{}, pErr
			}

			nextDay := time.Now().AddDate(0, 0, d)
			occurrence := wallClock.AddDate(nextDay.Year(), int(nextDay.Month())-1, nextDay.Day()-1)
			times = append(times, a.chooseClosest(user, &occurrence, false))

			break
		case T("app.reminder.chrono.sunday"),
			T("app.reminder.chrono.monday"),
			T("app.reminder.chrono.tuesday"),
			T("app.reminder.chrono.wednesday"),
			T("app.reminder.chrono.thursday"),
			T("app.reminder.chrono.friday"),
			T("app.reminder.chrono.saturday"):

			todayWeekDayNum := int(time.Now().Weekday())
			weekDayNum := a.weekDayNumber(dateUnit, user)
			day := 0

			if weekDayNum < todayWeekDayNum {
				day = 7 - (todayWeekDayNum - weekDayNum)
			} else if weekDayNum >= todayWeekDayNum {
				day = 7 + (weekDayNum - todayWeekDayNum)
			}

			timeUnitSplit := strings.Split(timeUnit, ":")
			hr, _ := strconv.Atoi(timeUnitSplit[0])
			ampm := strings.ToUpper(T("app.reminder.chrono.am"))

			if hr > 11 {
				ampm = strings.ToUpper(T("app.reminder.chrono.pm"))
			}
			if hr > 12 {
				hr -= 12
				timeUnitSplit[0] = strconv.Itoa(hr)
			}

			timeUnit = timeUnitSplit[0] + ":" + timeUnitSplit[1] + ampm
			wallClock, pErr := time.Parse(time.Kitchen, timeUnit)
			if pErr != nil {
				return []time.Time{}, pErr
			}

			nextDay := time.Now().AddDate(0, 0, day)
			occurrence := wallClock.AddDate(nextDay.Year(), int(nextDay.Month())-1, nextDay.Day()-1)
			times = append(times, a.chooseClosest(user, &occurrence, false))
			break
		default:

			dateSplit := a.regSplit(dateUnit, "T|Z")

			if len(dateSplit) < 3 {
				timeSplit := strings.Split(dateSplit[1], "-")
				t, tErr := time.Parse(time.RFC3339, dateSplit[0]+"T"+timeUnit+"-"+timeSplit[1])
				if tErr != nil {
					return []time.Time{}, tErr
				}
				times = append(times, t)
			} else {
				t, tErr := time.Parse(time.RFC3339, dateSplit[0]+"T"+timeUnit+"Z"+dateSplit[2])
				if tErr != nil {
					return []time.Time{}, tErr
				}
				times = append(times, t)
			}

		}

	}

	return times, nil

}

func (a *App) freeForm(when string, user *model.User) (times []time.Time, err error) {

	T, _ := a.translation(user)

	whenTrim := strings.Trim(when, " ")
	chronoUnit := strings.ToLower(whenTrim)
	dateTimeSplit := strings.Split(chronoUnit, " "+T("app.reminder.chrono.at")+" ")
	chronoTime := model.DEFAULT_TIME
	chronoDate := dateTimeSplit[0]

	if len(dateTimeSplit) > 1 {
		chronoTime = dateTimeSplit[1]
	}
	dateUnit, ndErr := a.normalizeDate(chronoDate, user)
	if ndErr != nil {
		return []time.Time{}, ndErr
	}
	timeUnit, ntErr := a.normalizeTime(chronoTime, user)
	if ntErr != nil {
		return []time.Time{}, ntErr
	}
	timeUnit = chronoTime

	switch dateUnit {
	case T("app.reminder.chrono.today"):
		return a.at(T("app.reminder.chrono.at")+" "+timeUnit, user)
	case T("app.reminder.chrono.tomorrow"):
		return a.on(
			T("app.reminder.chrono.on")+" "+
				time.Now().Add(time.Hour*24).Weekday().String()+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case T("app.reminder.chrono.everyday"):
		return a.every(
			T("app.reminder.chrono.every")+" "+
				T("app.reminder.chrono.day")+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case T("app.reminder.chrono.mondays"),
		T("app.reminder.chrono.tuesdays"),
		T("app.reminder.chrono.wednesdays"),
		T("app.reminder.chrono.thursdays"),
		T("app.reminder.chrono.fridays"),
		T("app.reminder.chrono.saturdays"),
		T("app.reminder.chrono.sundays"):
		return a.every(
			T("app.reminder.chrono.every")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case T("app.reminder.chrono.monday"),
		T("app.reminder.chrono.tuesday"),
		T("app.reminder.chrono.wednesday"),
		T("app.reminder.chrono.thursday"),
		T("app.reminder.chrono.friday"),
		T("app.reminder.chrono.saturday"),
		T("app.reminder.chrono.sunday"):
		return a.on(
			T("app.reminder.chrono.on")+" "+
				dateUnit+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	default:
		return a.on(
			T("app.reminder.chrono.on")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				T("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	}

}

func (a *App) normalizeTime(text string, user *model.User) (string, error) {

	T, _ := a.translation(user)

	switch text {
	case T("app.reminder.chrono.noon"):
		return "12:00:00", nil
	case T("app.reminder.chrono.midnight"):
		return "00:00:00", nil
	case T("app.reminder.chrono.one"),
		T("app.reminder.chrono.two"),
		T("app.reminder.chrono.three"),
		T("app.reminder.chrono.four"),
		T("app.reminder.chrono.five"),
		T("app.reminder.chrono.six"),
		T("app.reminder.chrono.seven"),
		T("app.reminder.chrono.eight"),
		T("app.reminder.chrono.nine"),
		T("app.reminder.chrono.ten"),
		T("app.reminder.chrono.eleven"),
		T("app.reminder.chrono.twelve"):

		num, wErr := a.wordToNumber(text, user)
		if wErr != nil {
			mlog.Error(fmt.Sprintf("%v", wErr))
			return "", wErr
		}

		wordTime := time.Now().Round(time.Hour).Add(time.Hour * time.Duration(num+2))

		dateTimeSplit := a.regSplit(a.chooseClosest(user, &wordTime, false).Format(time.RFC3339), "T|Z")

		switch len(dateTimeSplit) {
		case 2:
			tzSplit := strings.Split(dateTimeSplit[1], "-")
			return tzSplit[0], nil
		case 3:
			break
		default:
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil

	case T("app.reminder.chrono.0"),
		T("app.reminder.chrono.1"),
		T("app.reminder.chrono.2"),
		T("app.reminder.chrono.3"),
		T("app.reminder.chrono.4"),
		T("app.reminder.chrono.5"),
		T("app.reminder.chrono.6"),
		T("app.reminder.chrono.7"),
		T("app.reminder.chrono.8"),
		T("app.reminder.chrono.9"),
		T("app.reminder.chrono.10"),
		T("app.reminder.chrono.11"),
		T("app.reminder.chrono.12"),
		T("app.reminder.chrono.13"),
		T("app.reminder.chrono.14"),
		T("app.reminder.chrono.15"),
		T("app.reminder.chrono.16"),
		T("app.reminder.chrono.17"),
		T("app.reminder.chrono.18"),
		T("app.reminder.chrono.19"),
		T("app.reminder.chrono.20"),
		T("app.reminder.chrono.21"),
		T("app.reminder.chrono.22"),
		T("app.reminder.chrono.23"):

		num, nErr := strconv.Atoi(text)
		if nErr != nil {
			return "", nErr
		}

		numTime := time.Now().Round(time.Hour).Add(time.Hour * time.Duration(num))
		dateTimeSplit := a.regSplit(a.chooseClosest(user, &numTime, false).Format(time.RFC3339), "T|Z")

		switch len(dateTimeSplit) {
		case 2:
			tzSplit := strings.Split(dateTimeSplit[1], "-")
			return tzSplit[0], nil
		case 3:
			break
		default:
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil

	default:
		break
	}

	t := text
	if match, _ := regexp.MatchString("(1[012]|[1-9]):[0-5][0-9](\\s)?(?i)(am|pm)", t); match { // 12:30PM, 12:30 pm

		t = strings.ToUpper(strings.Replace(t, " ", "", -1))
		test, tErr := time.Parse(time.Kitchen, t)
		if tErr != nil {
			return "", tErr
		}

		dateTimeSplit := a.regSplit(test.Format(time.RFC3339), "T|Z")
		if len(dateTimeSplit) != 3 {
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil
	} else if match, _ := regexp.MatchString("(1[012]|[1-9]):[0-5][0-9]", t); match { // 12:30

		nowkit := time.Now().Format(time.Kitchen)
		ampm := string(nowkit[len(nowkit)-2:])
		timeUnitSplit := strings.Split(t, ":")
		hr, _ := strconv.Atoi(timeUnitSplit[0])

		if hr > 11 {
			ampm = strings.ToUpper(T("app.reminder.chrono.pm"))
		}
		if hr > 12 {
			hr -= 12
			timeUnitSplit[0] = strconv.Itoa(hr)
		}

		t = timeUnitSplit[0] + ":" + timeUnitSplit[1] + ampm

		test, tErr := time.Parse(time.Kitchen, t)
		if tErr != nil {
			return "", tErr
		}

		dateTimeSplit := a.regSplit(a.chooseClosest(user, &test, false).Format(time.RFC3339), "T|Z")
		if len(dateTimeSplit) != 3 {
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil

	} else if match, _ := regexp.MatchString("(1[012]|[1-9])(\\s)?(?i)(am|pm)", t); match { // 5PM, 7 am

		nowkit := time.Now().Format(time.Kitchen)
		ampm := string(nowkit[len(nowkit)-2:])

		timeSplit := a.regSplit(t, "(?i)(am|pm)")

		test, tErr := time.Parse(time.Kitchen, timeSplit[0]+":00"+ampm)
		if tErr != nil {
			return "", tErr
		}

		dateTimeSplit := a.regSplit(a.chooseClosest(user, &test, false).Format(time.RFC3339), "T|Z")
		if len(dateTimeSplit) != 3 {
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil
	} else if match, _ := regexp.MatchString("(1[012]|[1-9])[0-5][0-9]", t); match { // 1200

		return t[:len(t)-2] + ":" + t[len(t)-2:] + ":00", nil

	}

	return "", errors.New("unable to normalize time")
}

func (a *App) normalizeDate(text string, user *model.User) (string, error) {

	_, cfg, location, _, T := a.shared(user.Id)

	date := strings.ToLower(text)
	if strings.EqualFold(T("app.reminder.chrono.day"), date) {
		return date, nil
	} else if strings.EqualFold(T("app.reminder.chrono.today"), date) {
		return date, nil
	} else if strings.EqualFold(T("app.reminder.chrono.everyday"), date) {
		return date, nil
	} else if strings.EqualFold(T("app.reminder.chrono.tomorrow"), date) {
		return date, nil
	}

	switch date {
	case T("app.reminder.chrono.mon"),
		T("app.reminder.chrono.monday"):
		return T("app.reminder.chrono.monday"), nil
	case T("app.reminder.chrono.tues"),
		T("app.reminder.chrono.tuesday"):
		return T("app.reminder.chrono.tuesday"), nil
	case T("app.reminder.chrono.wed"),
		T("app.reminder.chrono.wednes"),
		T("app.reminder.chrono.wednesday"):
		return T("app.reminder.chrono.wednesday"), nil
	case T("app.reminder.chrono.thur"),
		T("app.reminder.chrono.thursday"):
		return T("app.reminder.chrono.thursday"), nil
	case T("app.reminder.chrono.fri"),
		T("app.reminder.chrono.friday"):
		return T("app.reminder.chrono.friday"), nil
	case T("app.reminder.chrono.sat"),
		T("app.reminder.chrono.satur"),
		T("app.reminder.chrono.saturday"):
		return T("app.reminder.chrono.saturday"), nil
	case T("app.reminder.chrono.sun"),
		T("app.reminder.chrono.sunday"):
		return T("app.reminder.chrono.sunday"), nil
	case T("app.reminder.chrono.mondays"),
		T("app.reminder.chrono.tuesdays"),
		T("app.reminder.chrono.wednesdays"),
		T("app.reminder.chrono.thursdays"),
		T("app.reminder.chrono.fridays"),
		T("app.reminder.chrono.saturdays"),
		T("app.reminder.chrono.sundays"):
		return date, nil
	}

	if strings.Contains(date, T("app.reminder.chrono.jan")) ||
		strings.Contains(date, T("app.reminder.chrono.january")) ||
		strings.Contains(date, T("app.reminder.chrono.feb")) ||
		strings.Contains(date, T("app.reminder.chrono.february")) ||
		strings.Contains(date, T("app.reminder.chrono.mar")) ||
		strings.Contains(date, T("app.reminder.chrono.march")) ||
		strings.Contains(date, T("app.reminder.chrono.apr")) ||
		strings.Contains(date, T("app.reminder.chrono.april")) ||
		strings.Contains(date, T("app.reminder.chrono.may")) ||
		strings.Contains(date, T("app.reminder.chrono.june")) ||
		strings.Contains(date, T("app.reminder.chrono.july")) ||
		strings.Contains(date, T("app.reminder.chrono.aug")) ||
		strings.Contains(date, T("app.reminder.chrono.august")) ||
		strings.Contains(date, T("app.reminder.chrono.sept")) ||
		strings.Contains(date, T("app.reminder.chrono.september")) ||
		strings.Contains(date, T("app.reminder.chrono.oct")) ||
		strings.Contains(date, T("app.reminder.chrono.october")) ||
		strings.Contains(date, T("app.reminder.chrono.nov")) ||
		strings.Contains(date, T("app.reminder.chrono.november")) ||
		strings.Contains(date, T("app.reminder.chrono.dec")) ||
		strings.Contains(date, T("app.reminder.chrono.december")) {

		date = strings.Replace(date, ",", "", -1)
		parts := strings.Split(date, " ")

		switch len(parts) {
		case 1:
			break
		case 2:
			if len(parts[1]) > 2 {
				parts[1] = a.daySuffix(user, parts[1])
			}
			if _, err := strconv.Atoi(parts[1]); err != nil {
				if wn, wErr := a.wordToNumber(parts[1], user); wErr == nil {
					parts[1] = strconv.Itoa(wn)
				}
			}

			parts = append(parts, fmt.Sprintf("%v", time.Now().Year()))

			break
		case 3:
			if len(parts[1]) > 2 {
				parts[1] = a.daySuffix(user, parts[1])
			}

			if _, err := strconv.Atoi(parts[1]); err != nil {
				if wn, wErr := a.wordToNumber(parts[1], user); wErr == nil {
					parts[1] = strconv.Itoa(wn)
				} else {
					mlog.Error(wErr.Error())
				}

				if _, pErr := strconv.Atoi(parts[2]); pErr != nil {
					return "", pErr
				}
			}

			break
		default:
			return "", errors.New("unrecognized date format")
		}

		switch parts[0] {
		case T("app.reminder.chrono.jan"),
			T("app.reminder.chrono.january"):
			parts[0] = "01"
			break
		case T("app.reminder.chrono.feb"),
			T("app.reminder.chrono.february"):
			parts[0] = "02"
			break
		case T("app.reminder.chrono.mar"),
			T("app.reminder.chrono.march"):
			parts[0] = "03"
			break
		case T("app.reminder.chrono.apr"),
			T("app.reminder.chrono.april"):
			parts[0] = "04"
			break
		case T("app.reminder.chrono.may"):
			parts[0] = "05"
			break
		case T("app.reminder.chrono.june"):
			parts[0] = "06"
			break
		case T("app.reminder.chrono.july"):
			parts[0] = "07"
			break
		case T("app.reminder.chrono.aug"),
			T("app.reminder.chrono.august"):
			parts[0] = "08"
			break
		case T("app.reminder.chrono.sept"),
			T("app.reminder.chrono.september"):
			parts[0] = "09"
			break
		case T("app.reminder.chrono.oct"),
			T("app.reminder.chrono.october"):
			parts[0] = "10"
			break
		case T("app.reminder.chrono.nov"),
			T("app.reminder.chrono.november"):
			parts[0] = "11"
			break
		case T("app.reminder.chrono.dec"),
			T("app.reminder.chrono.december"):
			parts[0] = "12"
			break
		default:
			return "", errors.New("month not found")
		}

		if len(parts[1]) < 2 {
			parts[1] = "0" + parts[1]
		}
		return parts[2] + "-" + parts[0] + "-" + parts[1] + "T00:00:00Z", nil

	} else if match, _ := regexp.MatchString("^(([0-9]{2}|[0-9]{1})(-|/)([0-9]{2}|[0-9]{1})((-|/)([0-9]{4}|[0-9]{2}))?)", date); match {

		date := a.regSplit(date, "-|/")

		switch len(date) {
		case 2:
			year := time.Now().Year()
			month, mErr := strconv.Atoi(date[0])
			if mErr != nil {
				return "", mErr
			}
			day, dErr := strconv.Atoi(date[1])
			if dErr != nil {
				return "", dErr
			}

			if *cfg.DisplaySettings.ExperimentalTimezone {
				return time.Date(year, time.Month(month), day, 0, 0, 0, 0, location).Format(time.RFC3339), nil
			}

			return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local).Format(time.RFC3339), nil

		case 3:
			if len(date[2]) == 2 {
				date[2] = "20" + date[2]
			}
			year, yErr := strconv.Atoi(date[2])
			if yErr != nil {
				return "", yErr
			}
			month, mErr := strconv.Atoi(date[0])
			if mErr != nil {
				return "", mErr
			}
			day, dErr := strconv.Atoi(date[1])
			if dErr != nil {
				return "", dErr
			}

			if *cfg.DisplaySettings.ExperimentalTimezone {
				return time.Date(year, time.Month(month), day, 0, 0, 0, 0, location).Format(time.RFC3339), nil
			}

			return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local).Format(time.RFC3339), nil

		default:
			return "", errors.New("unrecognized date")
		}

	} else { //single number day

		var dayInt int
		day := a.daySuffix(user, date)

		if d, nErr := strconv.Atoi(day); nErr != nil {
			if wordNum, wErr := a.wordToNumber(date, user); wErr != nil {
				return "", wErr
			} else {
				day = strconv.Itoa(wordNum)
				dayInt = wordNum
			}
		} else {
			dayInt = d
		}

		month := time.Now().Month()
		year := time.Now().Year()

		var t time.Time
		if *cfg.DisplaySettings.ExperimentalTimezone {
			t = time.Date(year, month, dayInt, 0, 0, 0, 0, location)
		} else {
			t = time.Date(year, month, dayInt, 0, 0, 0, 0, time.Local)
		}

		if t.Before(time.Now()) {
			t = t.AddDate(0, 1, 0)
		}

		return t.Format(time.RFC3339), nil

	}

}

func (a *App) daySuffixFromInt(user *model.User, day int) string {

	T, _ := a.translation(user)

	daySuffixes := []string{
		T("app.reminder.chrono.0th"),
		T("app.reminder.chrono.1st"),
		T("app.reminder.chrono.2nd"),
		T("app.reminder.chrono.3rd"),
		T("app.reminder.chrono.4th"),
		T("app.reminder.chrono.5th"),
		T("app.reminder.chrono.6th"),
		T("app.reminder.chrono.7th"),
		T("app.reminder.chrono.8th"),
		T("app.reminder.chrono.9th"),
		T("app.reminder.chrono.10th"),
		T("app.reminder.chrono.11th"),
		T("app.reminder.chrono.12th"),
		T("app.reminder.chrono.13th"),
		T("app.reminder.chrono.14th"),
		T("app.reminder.chrono.15th"),
		T("app.reminder.chrono.16th"),
		T("app.reminder.chrono.17th"),
		T("app.reminder.chrono.18th"),
		T("app.reminder.chrono.19th"),
		T("app.reminder.chrono.20th"),
		T("app.reminder.chrono.21st"),
		T("app.reminder.chrono.22nd"),
		T("app.reminder.chrono.23rd"),
		T("app.reminder.chrono.24th"),
		T("app.reminder.chrono.25th"),
		T("app.reminder.chrono.26th"),
		T("app.reminder.chrono.27th"),
		T("app.reminder.chrono.28th"),
		T("app.reminder.chrono.29th"),
		T("app.reminder.chrono.30th"),
		T("app.reminder.chrono.31st"),
	}
	return daySuffixes[day]

}

func (a *App) daySuffix(user *model.User, day string) string {

	T, _ := a.translation(user)

	daySuffixes := []string{
		T("app.reminder.chrono.0th"),
		T("app.reminder.chrono.1st"),
		T("app.reminder.chrono.2nd"),
		T("app.reminder.chrono.3rd"),
		T("app.reminder.chrono.4th"),
		T("app.reminder.chrono.5th"),
		T("app.reminder.chrono.6th"),
		T("app.reminder.chrono.7th"),
		T("app.reminder.chrono.8th"),
		T("app.reminder.chrono.9th"),
		T("app.reminder.chrono.10th"),
		T("app.reminder.chrono.11th"),
		T("app.reminder.chrono.12th"),
		T("app.reminder.chrono.13th"),
		T("app.reminder.chrono.14th"),
		T("app.reminder.chrono.15th"),
		T("app.reminder.chrono.16th"),
		T("app.reminder.chrono.17th"),
		T("app.reminder.chrono.18th"),
		T("app.reminder.chrono.19th"),
		T("app.reminder.chrono.20th"),
		T("app.reminder.chrono.21st"),
		T("app.reminder.chrono.22nd"),
		T("app.reminder.chrono.23rd"),
		T("app.reminder.chrono.24th"),
		T("app.reminder.chrono.25th"),
		T("app.reminder.chrono.26th"),
		T("app.reminder.chrono.27th"),
		T("app.reminder.chrono.28th"),
		T("app.reminder.chrono.29th"),
		T("app.reminder.chrono.30th"),
		T("app.reminder.chrono.31st"),
	}
	for _, suffix := range daySuffixes {
		if suffix == day {
			day = day[:len(day)-2]
			break
		}
	}
	return day
}

func (a *App) weekDayNumber(day string, user *model.User) int {

	T, _ := a.translation(user)

	switch day {
	case T("app.reminder.chrono.sunday"):
		return 0
	case T("app.reminder.chrono.monday"):
		return 1
	case T("app.reminder.chrono.tuesday"):
		return 2
	case T("app.reminder.chrono.wednesday"):
		return 3
	case T("app.reminder.chrono.thursday"):
		return 4
	case T("app.reminder.chrono.friday"):
		return 5
	case T("app.reminder.chrono.saturday"):
		return 6
	default:
		return -1
	}
}

func (a *App) regSplit(text string, delimeter string) []string {

	reg := regexp.MustCompile(delimeter)
	indexes := reg.FindAllStringIndex(text, -1)
	laststart := 0
	result := make([]string, len(indexes)+1)
	for i, element := range indexes {
		result[i] = text[laststart:element[0]]
		laststart = element[1]
	}
	result[len(indexes)] = text[laststart:]
	return result
}

func (a *App) wordToNumber(word string, user *model.User) (int, error) {

	T, _ := a.translation(user)

	var sum int
	var temp int
	var previous int

	numbers := make(map[string]int)
	onumbers := make(map[string]int)
	tnumbers := make(map[string]int)

	numbers[T("app.reminder.chrono.zero")] = 0
	numbers[T("app.reminder.chrono.one")] = 1
	numbers[T("app.reminder.chrono.two")] = 2
	numbers[T("app.reminder.chrono.three")] = 3
	numbers[T("app.reminder.chrono.four")] = 4
	numbers[T("app.reminder.chrono.five")] = 5
	numbers[T("app.reminder.chrono.six")] = 6
	numbers[T("app.reminder.chrono.seven")] = 7
	numbers[T("app.reminder.chrono.eight")] = 8
	numbers[T("app.reminder.chrono.nine")] = 9
	numbers[T("app.reminder.chrono.ten")] = 10
	numbers[T("app.reminder.chrono.eleven")] = 11
	numbers[T("app.reminder.chrono.twelve")] = 12
	numbers[T("app.reminder.chrono.thirteen")] = 13
	numbers[T("app.reminder.chrono.fourteen")] = 14
	numbers[T("app.reminder.chrono.fifteen")] = 15
	numbers[T("app.reminder.chrono.sixteen")] = 16
	numbers[T("app.reminder.chrono.seventeen")] = 17
	numbers[T("app.reminder.chrono.eighteen")] = 18
	numbers[T("app.reminder.chrono.nineteen")] = 19

	tnumbers[T("app.reminder.chrono.twenty")] = 20
	tnumbers[T("app.reminder.chrono.thirty")] = 30
	tnumbers[T("app.reminder.chrono.forty")] = 40
	tnumbers[T("app.reminder.chrono.fifty")] = 50
	tnumbers[T("app.reminder.chrono.sixty")] = 60
	tnumbers[T("app.reminder.chrono.seventy")] = 70
	tnumbers[T("app.reminder.chrono.eighty")] = 80
	tnumbers[T("app.reminder.chrono.ninety")] = 90

	onumbers[T("app.reminder.chrono.hundred")] = 100
	onumbers[T("app.reminder.chrono.thousand")] = 1000
	onumbers[T("app.reminder.chrono.million")] = 1000000
	onumbers[T("app.reminder.chrono.billion")] = 1000000000

	numbers[T("app.reminder.chrono.first")] = 1
	numbers[T("app.reminder.chrono.second")] = 2
	numbers[T("app.reminder.chrono.third")] = 3
	numbers[T("app.reminder.chrono.fourth")] = 4
	numbers[T("app.reminder.chrono.fifth")] = 5
	numbers[T("app.reminder.chrono.sixth")] = 6
	numbers[T("app.reminder.chrono.seventh")] = 7
	numbers[T("app.reminder.chrono.eighth")] = 8
	numbers[T("app.reminder.chrono.nineth")] = 9
	numbers[T("app.reminder.chrono.tenth")] = 10
	numbers[T("app.reminder.chrono.eleventh")] = 11
	numbers[T("app.reminder.chrono.twelveth")] = 12
	numbers[T("app.reminder.chrono.thirteenth")] = 13
	numbers[T("app.reminder.chrono.fourteenth")] = 14
	numbers[T("app.reminder.chrono.fifteenth")] = 15
	numbers[T("app.reminder.chrono.sixteenth")] = 16
	numbers[T("app.reminder.chrono.seventeenth")] = 17
	numbers[T("app.reminder.chrono.eighteenth")] = 18
	numbers[T("app.reminder.chrono.nineteenth")] = 19

	tnumbers[T("app.reminder.chrono.twenteth")] = 20
	tnumbers[T("app.reminder.chrono.twentyfirst")] = 21
	tnumbers[T("app.reminder.chrono.twentysecond")] = 22
	tnumbers[T("app.reminder.chrono.twentythird")] = 23
	tnumbers[T("app.reminder.chrono.twentyfourth")] = 24
	tnumbers[T("app.reminder.chrono.twentyfifth")] = 25
	tnumbers[T("app.reminder.chrono.twentysixth")] = 26
	tnumbers[T("app.reminder.chrono.twentyseventh")] = 27
	tnumbers[T("app.reminder.chrono.twentyeight")] = 28
	tnumbers[T("app.reminder.chrono.twentynineth")] = 29
	tnumbers[T("app.reminder.chrono.thirteth")] = 30
	tnumbers[T("app.reminder.chrono.thirtyfirst")] = 31

	splitted := strings.Split(strings.ToLower(word), " ")

	for _, split := range splitted {
		if numbers[split] != 0 {
			temp = numbers[split]
			sum = sum + temp
			previous = previous + temp
		} else if onumbers[split] != 0 {
			if sum != 0 {
				sum = sum - previous
			}
			sum = sum + previous*onumbers[split]
			temp = 0
			previous = 0
		} else if tnumbers[split] != 0 {
			temp = tnumbers[split]
			sum = sum + temp
		}
	}

	if sum == 0 {
		return 0, errors.New("couldn't format number")
	}

	return sum, nil
}

func (a *App) chooseClosest(user *model.User, chosen *time.Time, dayInterval bool) time.Time {

	_, cfg, location, _, _ := a.shared(user.Id)

	if dayInterval {
		if chosen.Before(time.Now()) {
			if *cfg.DisplaySettings.ExperimentalTimezone {
				return chosen.In(location).Round(time.Second).Add(time.Hour * 24 * time.Duration(1))
			} else {
				return chosen.Round(time.Second).Add(time.Hour * 24 * time.Duration(1))
			}
		} else {
			return *chosen
		}
	} else {
		if chosen.Before(time.Now()) {
			if chosen.Add(time.Hour * 12 * time.Duration(1)).Before(time.Now()) {
				if *cfg.DisplaySettings.ExperimentalTimezone {
					return chosen.In(location).Round(time.Second).Add(time.Hour * 24 * time.Duration(1))
				} else {
					return chosen.Round(time.Second).Add(time.Hour * 24 * time.Duration(1))
				}
			} else {
				if *cfg.DisplaySettings.ExperimentalTimezone {
					return chosen.In(location).Round(time.Second).Add(time.Hour * 12 * time.Duration(1))
				} else {
					return chosen.Round(time.Second).Add(time.Hour * 12 * time.Duration(1))
				}
			}
		} else {
			return *chosen
		}
	}
}

func (a *App) shared(userId string) (*model.User, *model.Config, *time.Location, string, i18n.TranslateFunc) {

	user, _ := a.GetUser(userId)

	cfg := a.Config()

	timezone := user.GetPreferredTimezone()
	if timezone == "" {
		timezone, _ = time.Now().Zone()
	}
	location, _ := time.LoadLocation(timezone)

	T, locale := a.translation(user)

	return user, cfg, location, locale, T

}

func (a *App) translation(user *model.User) (i18n.TranslateFunc, string) {
	locale := "en"
	for _, l := range supportedLocales {
		if user.Locale == l {
			locale = user.Locale
		}
	}
	return utils.GetUserTranslations(locale), locale
}
