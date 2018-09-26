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

	if !running {
		running = true
		a.runner()
	}

}

func (a *App) StopReminders() {
	running = false
}

// how does the behave in HA cluster?
func (a *App) runner() {

	go func() {
		<-time.NewTimer(time.Second).C
		a.triggerReminders()
		if !running {
			return
		}
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
				reminder = result.Data.(model.Reminders)[0]
			}

			user, _, translateFunc, sErr := a.shared(reminder.UserId)
			if sErr != nil {
				continue
			}

			if strings.HasPrefix(reminder.Target, "@") || strings.HasPrefix(reminder.Target, translateFunc("app.reminder.me")) {

				channel, cErr := a.GetDirectChannel(remindUser.Id, user.Id)
				if cErr != nil {
					continue
				}

				var finalTarget string
				finalTarget = reminder.Target
				if finalTarget == translateFunc("app.reminder.me") {
					finalTarget = translateFunc("app.reminder.you")
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
					Message:       translateFunc("app.reminder.message", messageParameters),
					Props:         model.StringInterface{},
					//Props: model.StringInterface{
					//	"attachments": []*model.SlackAttachment{
					//		{
					//			Text: "hello",
					//			Actions: []*model.PostAction{
					//				{
					//					Integration: &model.PostActionIntegration{
					//						Context: model.StringInterface{
					//							"s": "foo",
					//							"n": 3,
					//						},
					//						URL: ts.URL,
					//					},
					//					Name:       "action",
					//					Type:       "some_type",
					//					DataSource: "some_source",
					//				},
					//			},
					//		},
					//	},
					//},
				}

				if _, pErr := a.CreatePostAsUser(&interactivePost); pErr != nil {
					mlog.Error(fmt.Sprintf("%v", pErr))
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
					Message:       translateFunc("app.reminder.message", messageParameters),
					Props:         model.StringInterface{},

					//Props: model.StringInterface{
					//	"attachments": []*model.SlackAttachment{
					//		{
					//			Text: "hello",
					//			Actions: []*model.PostAction{
					//				{
					//					Integration: &model.PostActionIntegration{
					//						Context: model.StringInterface{
					//							"s": "foo",
					//							"n": 3,
					//						},
					//						URL: ts.URL,
					//					},
					//					Name:       "action",
					//					Type:       "some_type",
					//					DataSource: "some_source",
					//				},
					//			},
					//		},
					//	},
					//},
				}

				if _, pErr := a.CreatePostAsUser(&interactivePost); pErr != nil {
					mlog.Error(fmt.Sprintf("%v", pErr))
				}

			}
		}

	}
}

func (a *App) ListReminders(userId string) string {

	_, _, translateFunc, sErr := a.shared(userId)

	if sErr != nil {
		return model.REMIND_EXCEPTION_TEXT
	}

	reminders := a.getReminders(userId)

	var upcomingOccurrences []model.Occurrence
	var recurringOccurrences []model.Occurrence
	var pastOccurrences []model.Occurrence

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

				if reminder.Completed == emptyTime.Format(time.RFC3339) &&
					(occurrence.Repeat == "" && t.After(time.Now())) ||
					(s != emptyTime && s.After(time.Now())) {
					upcomingOccurrences = append(upcomingOccurrences, occurrence)
				}

				if occurrence.Repeat != "" &&
					t.After(time.Now()) {
					recurringOccurrences = append(recurringOccurrences, occurrence)
				}

				if reminder.Completed == emptyTime.Format(time.RFC3339) &&
					t.Before(time.Now()) &&
					s == emptyTime {
					pastOccurrences = append(pastOccurrences, occurrence)
				}

			}

		}

	}

	if len(upcomingOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			translateFunc("app.reminder.list_upcoming"),
			a.listReminderGroup(userId, &upcomingOccurrences, &reminders),
			"\n",
		}, "\n")
	}

	if len(recurringOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			translateFunc("app.reminder.list_recurring"),
			a.listReminderGroup(userId, &recurringOccurrences, &reminders),
			"\n",
		}, "\n")
	}

	if len(pastOccurrences) > 0 {
		output = strings.Join([]string{
			output,
			translateFunc("app.reminder.list_past_and_incomplete"),
			a.listReminderGroup(userId, &pastOccurrences, &reminders),
			"\n",
		}, "\n")
	}

	return output + translateFunc("app.reminder.list_footer")
}

func (a *App) listReminderGroup(userId string, occurrences *[]model.Occurrence, reminders *[]model.Reminder) string {

	_, location, translateFunc, _ := a.shared(userId)
	cfg := a.Config()

	var output string
	output = ""

	for _, occurrence := range *occurrences {

		reminder := a.findReminder(occurrence.ReminderId, reminders)
		t, tErr := time.Parse(time.RFC3339, occurrence.Occurrence)
		if tErr != nil {
			continue
		}

		var formattedOccurrence string
		if *cfg.DisplaySettings.ExperimentalTimezone {
			formattedOccurrence = t.In(location).Format(time.RFC3339)
		} else {
			formattedOccurrence = t.Format(time.RFC3339)
		}

		var messageParameters = map[string]interface{}{
			"Message":    reminder.Message,
			"Occurrence": fmt.Sprintf("%v", formattedOccurrence),
		}
		if !t.Equal(emptyTime) {
			output = strings.Join([]string{output, translateFunc("app.reminder.list.element", messageParameters)}, "\n")
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

	_, _, translateFunc, _ := a.shared(userId)

	schan := a.Srv.Store.Remind().DeleteForUser(userId)
	if result := <-schan; result.Err != nil {
		return ""
	}
	return translateFunc("app.reminder.ok_deleted")
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

	_, _, translateFunc, _ := a.shared(request.UserId)

	if pErr := a.parseRequest(request); pErr != nil {
		mlog.Error(pErr.Error())
		return translateFunc(model.REMIND_EXCEPTION_TEXT), nil
	}

	useTo := strings.HasPrefix(request.Reminder.Message, translateFunc("app.reminder.chrono.to"))
	var useToString string
	if useTo {
		useToString = " " + translateFunc("app.reminder.chrono.to")
	} else {
		useToString = ""
	}

	//RFC3339
	request.Reminder.Id = model.NewId()
	request.Reminder.TeamId = request.TeamId
	request.Reminder.UserId = request.UserId
	request.Reminder.Completed = emptyTime.Format(time.RFC3339)

	if cErr := a.createOccurrences(request); cErr != nil {
		mlog.Error(cErr.Error())
		return translateFunc(model.REMIND_EXCEPTION_TEXT), nil
	}

	schan := a.Srv.Store.Remind().SaveReminder(&request.Reminder)
	if result := <-schan; result.Err != nil {
		mlog.Error(result.Err.Message)
		return translateFunc(model.REMIND_EXCEPTION_TEXT), nil
	}

	if request.Reminder.Target == translateFunc("app.reminder.me") {
		request.Reminder.Target = translateFunc("app.reminder.you")
	}

	var responseParameters = map[string]interface{}{
		"Target":  request.Reminder.Target,
		"UseTo":   useToString,
		"Message": request.Reminder.Message,
		"When":    request.Reminder.When,
	}
	response := translateFunc("app.reminder.response", responseParameters)

	return response, nil
}

func (a *App) parseRequest(request *model.ReminderRequest) error {

	_, _, translateFunc, _ := a.shared(request.UserId)

	commandSplit := strings.Split(request.Payload, " ")

	if strings.HasPrefix(request.Payload, translateFunc("app.reminder.me")) ||
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

	user, _, translateFunc, _ := a.shared(request.UserId)

	if strings.HasPrefix(request.Reminder.When, translateFunc("app.reminder.chrono.in")) {
		if occurrences, inErr := a.in(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, translateFunc("app.reminder.chrono.at")) {
		if occurrences, inErr := a.at(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, translateFunc("app.reminder.chrono.on")) {
		if occurrences, inErr := a.on(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	if strings.HasPrefix(request.Reminder.When, translateFunc("app.reminder.chrono.every")) {
		if occurrences, inErr := a.every(request.Reminder.When, user); inErr != nil {
			return inErr
		} else {
			return a.addOccurrences(request, occurrences)
		}
	}

	// TODO handle the other freeform when patterns

	return errors.New("unable to create occurrences")
}

func (a *App) addOccurrences(request *model.ReminderRequest, occurrences []time.Time) error {

	for _, o := range occurrences {

		//RFC3339
		occurrence := &model.Occurrence{
			model.NewId(),
			request.UserId,
			request.Reminder.Id,
			"",
			o.Format(time.RFC3339),
			emptyTime.Format(time.RFC3339),
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

func (a *App) findWhen(request *model.ReminderRequest) error {

	user, _, translateFunc, _ := a.shared(request.UserId)

	inIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.in")+" ")
	if inIndex > -1 {
		request.Reminder.When = strings.Trim(request.Payload[inIndex:], " ")
		return nil
	}

	everyIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.every")+" ")
	atIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (everyIndex > -1 && atIndex == -1) || (atIndex > everyIndex) && everyIndex != -1 {
		request.Reminder.When = strings.Trim(request.Payload[everyIndex:], " ")
		return nil
	}

	onIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.on")+" ")
	if inIndex > -1 {
		request.Reminder.When = strings.Trim(request.Payload[onIndex:], " ")
		return nil
	}

	everydayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.everyday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (everydayIndex > -1 && atIndex >= -1) && (atIndex > everydayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[everydayIndex:], " ")
		return nil
	}

	todayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.today")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (todayIndex > -1 && atIndex >= -1) && (atIndex > todayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[todayIndex:], " ")
		return nil
	}

	tomorrowIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.tomorrow")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (tomorrowIndex > -1 && atIndex >= -1) && (atIndex > tomorrowIndex) {
		request.Reminder.When = strings.Trim(request.Payload[tomorrowIndex:], " ")
		return nil
	}

	mondayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.monday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (mondayIndex > -1 && atIndex >= -1) && (atIndex > mondayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[mondayIndex:], " ")
		return nil
	}

	tuesdayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.tuesday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (tuesdayIndex > -1 && atIndex >= -1) && (atIndex > tuesdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[tuesdayIndex:], " ")
		return nil
	}

	wednesdayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.wednesday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (wednesdayIndex > -1 && atIndex >= -1) && (atIndex > wednesdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[wednesdayIndex:], " ")
		return nil
	}

	thursdayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.thursday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (thursdayIndex > -1 && atIndex >= -1) && (atIndex > thursdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[thursdayIndex:], " ")
		return nil
	}

	fridayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.friday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (fridayIndex > -1 && atIndex >= -1) && (atIndex > fridayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[fridayIndex:], " ")
		return nil
	}

	saturdayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.saturday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (saturdayIndex > -1 && atIndex >= -1) && (atIndex > saturdayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[saturdayIndex:], " ")
		return nil
	}

	sundayIndex := strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.sunday")+" ")
	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if (sundayIndex > -1 && atIndex >= -1) && (atIndex > sundayIndex) {
		request.Reminder.When = strings.Trim(request.Payload[sundayIndex:], " ")
		return nil
	}

	atIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	everyIndex = strings.Index(request.Payload, " "+translateFunc("app.reminder.chrono.every")+" ")
	if (atIndex > -1 && everyIndex >= -1) && (everyIndex > atIndex) {
		request.Reminder.When = strings.Trim(request.Payload[atIndex:], " ")
		return nil
	}

	textSplit := strings.Split(request.Payload, " ")

	if len(textSplit) == 1 {
		request.Reminder.When = textSplit[0]
		return nil
	}

	lastWord := textSplit[len(textSplit)-2] + " " + textSplit[len(textSplit)-1]
	_, dErr := a.normalizeDate(user, lastWord)
	if dErr == nil {
		request.Reminder.When = lastWord
		return nil
	} else {
		lastWord = textSplit[len(textSplit)-1]

		switch lastWord {
		case translateFunc("app.reminder.chrono.tomorrow"):
			request.Reminder.When = lastWord
			return nil
		case translateFunc("app.reminder.chrono.everyday"),
			translateFunc("app.reminder.chrono.mondays"),
			translateFunc("app.reminder.chrono.tuesdays"),
			translateFunc("app.reminder.chrono.wednesdays"),
			translateFunc("app.reminder.chrono.thursdays"),
			translateFunc("app.reminder.chrono.fridays"),
			translateFunc("app.reminder.chrono.saturdays"),
			translateFunc("app.reminder.chrono.sundays"):
			request.Reminder.When = lastWord
		default:
			break
		}

		_, dErr = a.normalizeDate(user, lastWord)
		if dErr == nil {
			request.Reminder.When = lastWord
			return nil
		} else {
			var firstWord string
			switch textSplit[0] {
			case translateFunc("app.reminder.chrono.at"):
				firstWord = textSplit[1]
				request.Reminder.When = textSplit[0] + " " + firstWord
				return nil
			case translateFunc("app.reminder.chrono.in"), translateFunc("app.reminder.chrono.on"):
				firstWord = textSplit[1] + " " + textSplit[2]
				request.Reminder.When = textSplit[0] + " " + firstWord
				return nil
			case translateFunc("app.reminder.chrono.tomorrow"),
				translateFunc("app.reminder.chrono.monday"),
				translateFunc("app.reminder.chrono.tuesday"),
				translateFunc("app.reminder.chrono.wednesday"),
				translateFunc("app.reminder.chrono.thursday"),
				translateFunc("app.reminder.chrono.friday"),
				translateFunc("app.reminder.chrono.saturday"),
				translateFunc("app.reminder.chrono.sunday"):
				firstWord = textSplit[0]
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

	_, location, translateFunc, _ := a.shared(user.Id)
	cfg := a.Config()

	whenSplit := strings.Split(when, " ")
	value := whenSplit[1]
	units := whenSplit[len(whenSplit)-1]

	switch units {
	case translateFunc("app.reminder.chrono.seconds"),
		translateFunc("app.reminder.chrono.second"),
		translateFunc("app.reminder.chrono.secs"),
		translateFunc("app.reminder.chrono.sec"),
		translateFunc("app.reminder.chrono.s"):

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

	case translateFunc("app.reminder.chrono.minutes"),
		translateFunc("app.reminder.chrono.minute"),
		translateFunc("app.reminder.chrono.min"):

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

	case translateFunc("app.reminder.chrono.hours"),
		translateFunc("app.reminder.chrono.hour"),
		translateFunc("app.reminder.chrono.hrs"),
		translateFunc("app.reminder.chrono.hr"):

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

	case translateFunc("app.reminder.chrono.days"),
		translateFunc("app.reminder.chrono.day"),
		translateFunc("app.reminder.chrono.d"):

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

	case translateFunc("app.reminder.chrono.weeks"),
		translateFunc("app.reminder.chrono.week"),
		translateFunc("app.reminder.chrono.wks"),
		translateFunc("app.reminder.chrono.wk"):

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

	case translateFunc("app.reminder.chrono.months"),
		translateFunc("app.reminder.chrono.month"),
		translateFunc("app.reminder.chrono.m"):

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

	case translateFunc("app.reminder.chrono.years"),
		translateFunc("app.reminder.chrono.year"),
		translateFunc("app.reminder.chrono.yr"),
		translateFunc("app.reminder.chrono.y"):

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

	return nil, errors.New("could not format 'in'")
}

func (a *App) at(when string, user *model.User) (times []time.Time, err error) {

	_, _, translateFunc, _ := a.shared(user.Id)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")
	normalizedWhen := strings.ToLower(whenSplit[1])

	if strings.Contains(when, translateFunc("app.reminder.chrono.every")) {

		dateTimeSplit := strings.Split(when, " "+translateFunc("app.reminder.chrono.every")+" ")
		mlog.Info(translateFunc("app.reminder.chrono.every") + " " + dateTimeSplit[1] + " " + dateTimeSplit[0])
		return a.every(translateFunc("app.reminder.chrono.every")+" "+dateTimeSplit[1]+" "+dateTimeSplit[0], user)

	} else if len(whenSplit) >= 3 &&
		(strings.EqualFold(whenSplit[2], translateFunc("app.reminder.chrono.pm")) ||
			strings.EqualFold(whenSplit[2], translateFunc("app.reminder.chrono.am"))) {

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

	} else if strings.HasSuffix(normalizedWhen, translateFunc("app.reminder.chrono.pm")) ||
		strings.HasSuffix(normalizedWhen, translateFunc("app.reminder.chrono.am")) {

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

	case translateFunc("app.reminder.chrono.noon"):

		now := time.Now()

		noon, pErr := time.Parse(time.Kitchen, "12:00PM")
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
			return []time.Time{}, pErr
		}

		noon = noon.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &noon, true)}, nil

	case translateFunc("app.reminder.chrono.midnight"):

		now := time.Now()

		midnight, pErr := time.Parse(time.Kitchen, "12:00AM")
		if pErr != nil {
			mlog.Error(fmt.Sprintf("%v", pErr))
			return []time.Time{}, pErr
		}

		midnight = midnight.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &midnight, true)}, nil

	case translateFunc("app.reminder.chrono.one"),
		translateFunc("app.reminder.chrono.two"),
		translateFunc("app.reminder.chrono.three"),
		translateFunc("app.reminder.chrono.four"),
		translateFunc("app.reminder.chrono.five"),
		translateFunc("app.reminder.chrono.six"),
		translateFunc("app.reminder.chrono.seven"),
		translateFunc("app.reminder.chrono.eight"),
		translateFunc("app.reminder.chrono.nine"),
		translateFunc("app.reminder.chrono.ten"),
		translateFunc("app.reminder.chrono.eleven"),
		translateFunc("app.reminder.chrono.twelve"):

		nowkit := time.Now().Format(time.Kitchen)
		ampm := string(nowkit[len(nowkit)-2:])

		num, wErr := a.wordToNumber(normalizedWhen, user)
		if wErr != nil {
			return []time.Time{}, wErr
		}

		wordTime, _ := time.Parse(time.Kitchen, strconv.Itoa(num)+":00"+ampm)
		return []time.Time{a.chooseClosest(user, &wordTime, false)}, nil

	case translateFunc("app.reminder.chrono.0"),
		translateFunc("app.reminder.chrono.1"),
		translateFunc("app.reminder.chrono.2"),
		translateFunc("app.reminder.chrono.3"),
		translateFunc("app.reminder.chrono.4"),
		translateFunc("app.reminder.chrono.5"),
		translateFunc("app.reminder.chrono.6"),
		translateFunc("app.reminder.chrono.7"),
		translateFunc("app.reminder.chrono.8"),
		translateFunc("app.reminder.chrono.9"),
		translateFunc("app.reminder.chrono.10"),
		translateFunc("app.reminder.chrono.11"),
		translateFunc("app.reminder.chrono.12"):

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
		ampm := translateFunc("app.reminder.chrono.am")

		if hr > 11 {
			ampm = translateFunc("app.reminder.chrono.pm")
		}
		if hr > 12 {
			hr -= 12
			timeSplit[0] = strconv.Itoa(hr)
			normalizedWhen = strings.Join(timeSplit, ":")
		}

		t, pErr := time.Parse(time.Kitchen, strings.ToUpper(normalizedWhen+ampm))
		if pErr != nil {
			return []time.Time{}, pErr
		}

		now := time.Now().Round(time.Hour * time.Duration(24))
		occurrence := t.AddDate(now.Year(), int(now.Month())-1, now.Day()-1)
		return []time.Time{a.chooseClosest(user, &occurrence, false)}, nil

	}

	return []time.Time{}, errors.New("could not format 'at'")
}

func (a *App) on(when string, user *model.User) (times []time.Time, err error) {

	_, _, translateFunc, _ := a.shared(user.Id)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")

	if len(whenSplit) < 2 {
		return []time.Time{}, errors.New("not enough arguments")
	}

	chronoUnit := strings.ToLower(strings.Join(whenSplit[1:], " "))
	dateTimeSplit := strings.Split(chronoUnit, " "+translateFunc("app.reminder.chrono.at")+" ")
	chronoDate := dateTimeSplit[0]
	chronoTime := model.DEFAULT_TIME
	if len(dateTimeSplit) > 1 {
		chronoTime = dateTimeSplit[1]
	}

	dateUnit, ndErr := a.normalizeDate(user, chronoDate)
	if ndErr != nil {
		return []time.Time{}, ndErr
	}
	timeUnit, ntErr := a.normalizeTime(user, chronoTime)
	if ntErr != nil {
		return []time.Time{}, ntErr
	}

	switch dateUnit {
	case translateFunc("app.reminder.chrono.sunday"),
		translateFunc("app.reminder.chrono.monday"),
		translateFunc("app.reminder.chrono.tuesday"),
		translateFunc("app.reminder.chrono.wednesday"),
		translateFunc("app.reminder.chrono.thursday"),
		translateFunc("app.reminder.chrono.friday"),
		translateFunc("app.reminder.chrono.saturday"):

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
		ampm := strings.ToUpper(translateFunc("app.reminder.chrono.am"))

		if hr > 11 {
			ampm = strings.ToUpper(translateFunc("app.reminder.chrono.pm"))
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

		break
	case translateFunc("app.reminder.chrono.mondays"),
		translateFunc("app.reminder.chrono.tuesdays"),
		translateFunc("app.reminder.chrono.wednesdays"),
		translateFunc("app.reminder.chrono.thursdays"),
		translateFunc("app.reminder.chrono.fridays"),
		translateFunc("app.reminder.chrono.saturdays"),
		translateFunc("app.reminder.chrono.sundays"):

		return a.every(
			translateFunc("app.reminder.chrono.every")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit[:len(timeUnit)-3],
			user)

		break
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

	_, _, translateFunc, _ := a.shared(user.Id)

	whenTrim := strings.Trim(when, " ")
	whenSplit := strings.Split(whenTrim, " ")

	if len(whenSplit) < 2 {
		return []time.Time{}, errors.New("not enough arguments")
	}

	var everyOther bool
	chronoUnit := strings.ToLower(strings.Join(whenSplit[1:], " "))
	otherSplit := strings.Split(chronoUnit, translateFunc("app.reminder.chrono.other"))
	if len(otherSplit) == 2 {
		chronoUnit = strings.Trim(otherSplit[1], " ")
		everyOther = true
	}
	dateTimeSplit := strings.Split(chronoUnit, " "+translateFunc("app.reminder.chrono.at")+" ")
	chronoDate := dateTimeSplit[0]
	chronoTime := model.DEFAULT_TIME
	if len(dateTimeSplit) > 1 {
		chronoTime = strings.Trim(dateTimeSplit[1], " ")
	}

	days := a.regSplit(chronoDate, "(and)|(,)")

	for _, chrono := range days {

		dateUnit, ndErr := a.normalizeDate(user, strings.Trim(chrono, " "))
		if ndErr != nil {
			return []time.Time{}, ndErr
		}
		timeUnit, ntErr := a.normalizeTime(user, chronoTime)
		if ntErr != nil {
			return []time.Time{}, ntErr
		}

		switch dateUnit {
		case translateFunc("app.reminder.chrono.day"):
			d := 1
			if everyOther {
				d = 2
			}

			timeUnitSplit := strings.Split(timeUnit, ":")
			hr, _ := strconv.Atoi(timeUnitSplit[0])
			ampm := strings.ToUpper(translateFunc("app.reminder.chrono.am"))

			if hr > 11 {
				ampm = strings.ToUpper(translateFunc("app.reminder.chrono.pm"))
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
		case translateFunc("app.reminder.chrono.sunday"),
			translateFunc("app.reminder.chrono.monday"),
			translateFunc("app.reminder.chrono.tuesday"),
			translateFunc("app.reminder.chrono.wednesday"),
			translateFunc("app.reminder.chrono.thursday"),
			translateFunc("app.reminder.chrono.friday"),
			translateFunc("app.reminder.chrono.saturday"):

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
			ampm := strings.ToUpper(translateFunc("app.reminder.chrono.am"))

			if hr > 11 {
				ampm = strings.ToUpper(translateFunc("app.reminder.chrono.pm"))
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

	_, _, translateFunc, _ := a.shared(user.Id)

	whenTrim := strings.Trim(when, " ")
	chronoUnit := strings.ToLower(whenTrim)
	dateTimeSplit := strings.Split(chronoUnit, " "+translateFunc("app.reminder.chrono.at")+" ")
	chronoTime := model.DEFAULT_TIME
	chronoDate := dateTimeSplit[0]

	if len(dateTimeSplit) > 1 {
		chronoTime = dateTimeSplit[1]
	}

	dateUnit, ndErr := a.normalizeDate(user, chronoDate)
	if ndErr != nil {
		return []time.Time{}, ndErr
	}
	timeUnit, ntErr := a.normalizeTime(user, chronoTime)
	if ntErr != nil {
		return []time.Time{}, ntErr
	}

	//remove seconds for internal function calls
	timeUnit = timeUnit[:len(timeUnit)-3]

	switch dateUnit {
	case translateFunc("app.reminder.chrono.today"):
		return a.at(translateFunc("app.reminder.chrono.at")+" "+timeUnit, user)
	case translateFunc("app.reminder.chrono.tomorrow"):
		return a.on(
			translateFunc("app.reminder.chrono.on")+" "+
				time.Now().Add(time.Hour*24).Weekday().String()+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case translateFunc("app.reminder.chrono.everyday"):
		return a.every(
			translateFunc("app.reminder.chrono.every")+" "+
				translateFunc("app.reminder.chrono.day")+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case translateFunc("app.reminder.chrono.mondays"),
		translateFunc("app.reminder.chrono.tuesdays"),
		translateFunc("app.reminder.chrono.wednesdays"),
		translateFunc("app.reminder.chrono.thursdays"),
		translateFunc("app.reminder.chrono.fridays"),
		translateFunc("app.reminder.chrono.saturdays"),
		translateFunc("app.reminder.chrono.sundays"):
		return a.every(
			translateFunc("app.reminder.chrono.every")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	case translateFunc("app.reminder.chrono.monday"),
		translateFunc("app.reminder.chrono.tuesday"),
		translateFunc("app.reminder.chrono.wednesday"),
		translateFunc("app.reminder.chrono.thursday"),
		translateFunc("app.reminder.chrono.friday"),
		translateFunc("app.reminder.chrono.saturday"),
		translateFunc("app.reminder.chrono.sunday"):
		return a.on(
			translateFunc("app.reminder.chrono.on")+" "+
				dateUnit+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	default:
		return a.on(
			translateFunc("app.reminder.chrono.on")+" "+
				dateUnit[:len(dateUnit)-1]+" "+
				translateFunc("app.reminder.chrono.at")+" "+
				timeUnit,
			user)
	}

	return []time.Time{}, nil
}

func (a *App) normalizeTime(user *model.User, text string) (string, error) {

	_, _, translateFunc, _ := a.shared(user.Id)

	switch text {
	case translateFunc("app.reminder.chrono.noon"):
		return "12:00:00", nil
	case translateFunc("app.reminder.chrono.midnight"):
		return "00:00:00", nil
	case translateFunc("app.reminder.chrono.one"),
		translateFunc("app.reminder.chrono.two"),
		translateFunc("app.reminder.chrono.three"),
		translateFunc("app.reminder.chrono.four"),
		translateFunc("app.reminder.chrono.five"),
		translateFunc("app.reminder.chrono.six"),
		translateFunc("app.reminder.chrono.seven"),
		translateFunc("app.reminder.chrono.eight"),
		translateFunc("app.reminder.chrono.nine"),
		translateFunc("app.reminder.chrono.ten"),
		translateFunc("app.reminder.chrono.eleven"),
		translateFunc("app.reminder.chrono.twelve"):

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
			break
		case 3:
			break
		default:
			return "", errors.New("unrecognized dateTime format")
		}

		return dateTimeSplit[1], nil

	case translateFunc("app.reminder.chrono.0"),
		translateFunc("app.reminder.chrono.1"),
		translateFunc("app.reminder.chrono.2"),
		translateFunc("app.reminder.chrono.3"),
		translateFunc("app.reminder.chrono.4"),
		translateFunc("app.reminder.chrono.5"),
		translateFunc("app.reminder.chrono.6"),
		translateFunc("app.reminder.chrono.7"),
		translateFunc("app.reminder.chrono.8"),
		translateFunc("app.reminder.chrono.9"),
		translateFunc("app.reminder.chrono.10"),
		translateFunc("app.reminder.chrono.11"),
		translateFunc("app.reminder.chrono.12"),
		translateFunc("app.reminder.chrono.13"),
		translateFunc("app.reminder.chrono.14"),
		translateFunc("app.reminder.chrono.15"),
		translateFunc("app.reminder.chrono.16"),
		translateFunc("app.reminder.chrono.17"),
		translateFunc("app.reminder.chrono.18"),
		translateFunc("app.reminder.chrono.19"),
		translateFunc("app.reminder.chrono.20"),
		translateFunc("app.reminder.chrono.21"),
		translateFunc("app.reminder.chrono.22"),
		translateFunc("app.reminder.chrono.23"):

		num, nErr := strconv.Atoi(text)
		if nErr != nil {
			return "", nErr
		}

		numTime := time.Now().Round(time.Hour).Add(time.Hour * time.Duration(num+2))
		dateTimeSplit := a.regSplit(a.chooseClosest(user, &numTime, false).Format(time.RFC3339), "T|Z")

		switch len(dateTimeSplit) {
		case 2:
			tzSplit := strings.Split(dateTimeSplit[1], "-")
			return tzSplit[0], nil
			break
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
			ampm = strings.ToUpper(translateFunc("app.reminder.chrono.pm"))
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

func (a *App) normalizeDate(user *model.User, text string) (string, error) {

	_, location, translateFunc, _ := a.shared(user.Id)
	cfg := a.Config()

	date := strings.ToLower(text)
	if strings.EqualFold(translateFunc("app.reminder.chrono.day"), date) {
		return date, nil
	} else if strings.EqualFold(translateFunc("app.reminder.chrono.today"), date) {
		return date, nil
	} else if strings.EqualFold(translateFunc("app.reminder.chrono.everyday"), date) {
		return date, nil
	} else if strings.EqualFold(translateFunc("app.reminder.chrono.tommorrow"), date) {
		return date, nil
	} else if match, _ := regexp.MatchString("^((mon|tues|wed(nes)?|thur(s)?|fri|sat(ur)?|sun)(day)?)", date); match {

		switch date {
		case translateFunc("app.reminder.chrono.mon"),
			translateFunc("app.reminder.chrono.monday"):
			return translateFunc("app.reminder.chrono.monday"), nil
		case translateFunc("app.reminder.chrono.tues"),
			translateFunc("app.reminder.chrono.tuesday"):
			return translateFunc("app.reminder.chrono.tuesday"), nil
		case translateFunc("app.reminder.chrono.wed"),
			translateFunc("app.reminder.chrono.wednes"),
			translateFunc("app.reminder.chrono.wednesday"):
			return translateFunc("app.reminder.chrono.wednesday"), nil
		case translateFunc("app.reminder.chrono.thur"),
			translateFunc("app.reminder.chrono.thursday"):
			return translateFunc("app.reminder.chrono.thursday"), nil
		case translateFunc("app.reminder.chrono.fri"),
			translateFunc("app.reminder.chrono.friday"):
			return translateFunc("app.reminder.chrono.friday"), nil
		case translateFunc("app.reminder.chrono.sat"),
			translateFunc("app.reminder.chrono.satur"),
			translateFunc("app.reminder.chrono.saturday"):
			return translateFunc("app.reminder.chrono.saturday"), nil
		case translateFunc("app.reminder.chrono.sun"),
			translateFunc("app.reminder.chrono.sunday"):
			return translateFunc("app.reminder.chrono.sunday"), nil
		case translateFunc("app.reminder.chrono.mondays"),
			translateFunc("app.reminder.chrono.tuesdays"),
			translateFunc("app.reminder.chrono.wednesdays"),
			translateFunc("app.reminder.chrono.thursdays"),
			translateFunc("app.reminder.chrono.fridays"),
			translateFunc("app.reminder.chrono.saturdays"),
			translateFunc("app.reminder.chrono.sundays"):
			return date, nil
		default:
			return "", errors.New("no day of week found")
		}

	} else if match, _ := regexp.MatchString("^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june|july|aug(ust)?|sept(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)", date); match {

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
		case translateFunc("app.reminder.chrono.jan"),
			translateFunc("app.reminder.chrono.january"):
			parts[0] = "01"
			break
		case translateFunc("app.reminder.chrono.feb"),
			translateFunc("app.reminder.chrono.february"):
			parts[0] = "02"
			break
		case translateFunc("app.reminder.chrono.mar"),
			translateFunc("app.reminder.chrono.march"):
			parts[0] = "03"
			break
		case translateFunc("app.reminder.chrono.apr"),
			translateFunc("app.reminder.chrono.april"):
			parts[0] = "04"
			break
		case translateFunc("app.reminder.chrono.may"):
			parts[0] = "05"
			break
		case translateFunc("app.reminder.chrono.june"):
			parts[0] = "06"
			break
		case translateFunc("app.reminder.chrono.july"):
			parts[0] = "07"
			break
		case translateFunc("app.reminder.chrono.aug"),
			translateFunc("app.reminder.chrono.august"):
			parts[0] = "08"
			break
		case translateFunc("app.reminder.chrono.sept"),
			translateFunc("app.reminder.chrono.september"):
			parts[0] = "09"
			break
		case translateFunc("app.reminder.chrono.oct"),
			translateFunc("app.reminder.chrono.october"):
			parts[0] = "10"
			break
		case translateFunc("app.reminder.chrono.nov"),
			translateFunc("app.reminder.chrono.november"):
			parts[0] = "11"
			break
		case translateFunc("app.reminder.chrono.dec"),
			translateFunc("app.reminder.chrono.december"):
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

	return "", errors.New("unrecognized time")
}

func (a *App) daySuffix(user *model.User, day string) string {

	_, _, translateFunc, _ := a.shared(user.Id)

	daySuffixes := []string{
		translateFunc("app.reminder.chrono.0th"),
		translateFunc("app.reminder.chrono.1st"),
		translateFunc("app.reminder.chrono.2nd"),
		translateFunc("app.reminder.chrono.3rd"),
		translateFunc("app.reminder.chrono.4th"),
		translateFunc("app.reminder.chrono.5th"),
		translateFunc("app.reminder.chrono.6th"),
		translateFunc("app.reminder.chrono.7th"),
		translateFunc("app.reminder.chrono.8th"),
		translateFunc("app.reminder.chrono.9th"),
		translateFunc("app.reminder.chrono.10th"),
		translateFunc("app.reminder.chrono.11th"),
		translateFunc("app.reminder.chrono.12th"),
		translateFunc("app.reminder.chrono.13th"),
		translateFunc("app.reminder.chrono.14th"),
		translateFunc("app.reminder.chrono.15th"),
		translateFunc("app.reminder.chrono.16th"),
		translateFunc("app.reminder.chrono.17th"),
		translateFunc("app.reminder.chrono.18th"),
		translateFunc("app.reminder.chrono.19th"),
		translateFunc("app.reminder.chrono.20th"),
		translateFunc("app.reminder.chrono.21st"),
		translateFunc("app.reminder.chrono.22nd"),
		translateFunc("app.reminder.chrono.23rd"),
		translateFunc("app.reminder.chrono.24th"),
		translateFunc("app.reminder.chrono.25th"),
		translateFunc("app.reminder.chrono.26th"),
		translateFunc("app.reminder.chrono.27th"),
		translateFunc("app.reminder.chrono.28th"),
		translateFunc("app.reminder.chrono.29th"),
		translateFunc("app.reminder.chrono.30th"),
		translateFunc("app.reminder.chrono.31st"),
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

	_, _, translateFunc, _ := a.shared(user.Id)

	switch day {
	case translateFunc("app,reminder.chrono.sunday"):
		return 0
	case translateFunc("app,reminder.chrono.monday"):
		return 1
	case translateFunc("app,reminder.chrono.tuesday"):
		return 2
	case translateFunc("app,reminder.chrono.wednesday"):
		return 3
	case translateFunc("app,reminder.chrono.thursday"):
		return 4
	case translateFunc("app,reminder.chrono.friday"):
		return 5
	case translateFunc("app,reminder.chrono.saturday"):
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

	_, _, translateFunc, _ := a.shared(user.Id)

	var sum int
	var temp int
	var previous int

	numbers := make(map[string]int)
	onumbers := make(map[string]int)
	tnumbers := make(map[string]int)

	numbers[translateFunc("app.reminder.chrono.zero")] = 0
	numbers[translateFunc("app.reminder.chrono.one")] = 1
	numbers[translateFunc("app.reminder.chrono.two")] = 2
	numbers[translateFunc("app.reminder.chrono.three")] = 3
	numbers[translateFunc("app.reminder.chrono.four")] = 4
	numbers[translateFunc("app.reminder.chrono.five")] = 5
	numbers[translateFunc("app.reminder.chrono.six")] = 6
	numbers[translateFunc("app.reminder.chrono.seven")] = 7
	numbers[translateFunc("app.reminder.chrono.eight")] = 8
	numbers[translateFunc("app.reminder.chrono.nine")] = 9
	numbers[translateFunc("app.reminder.chrono.ten")] = 10
	numbers[translateFunc("app.reminder.chrono.eleven")] = 11
	numbers[translateFunc("app.reminder.chrono.twelve")] = 12
	numbers[translateFunc("app.reminder.chrono.thirteen")] = 13
	numbers[translateFunc("app.reminder.chrono.fourteen")] = 14
	numbers[translateFunc("app.reminder.chrono.fifteen")] = 15
	numbers[translateFunc("app.reminder.chrono.sixteen")] = 16
	numbers[translateFunc("app.reminder.chrono.seventeen")] = 17
	numbers[translateFunc("app.reminder.chrono.eighteen")] = 18
	numbers[translateFunc("app.reminder.chrono.nineteen")] = 19

	tnumbers[translateFunc("app.reminder.chrono.twenty")] = 20
	tnumbers[translateFunc("app.reminder.chrono.thirty")] = 30
	tnumbers[translateFunc("app.reminder.chrono.forty")] = 40
	tnumbers[translateFunc("app.reminder.chrono.fifty")] = 50
	tnumbers[translateFunc("app.reminder.chrono.sixty")] = 60
	tnumbers[translateFunc("app.reminder.chrono.seventy")] = 70
	tnumbers[translateFunc("app.reminder.chrono.eighty")] = 80
	tnumbers[translateFunc("app.reminder.chrono.ninety")] = 90

	onumbers[translateFunc("app.reminder.chrono.hundred")] = 100
	onumbers[translateFunc("app.reminder.chrono.thousand")] = 1000
	onumbers[translateFunc("app.reminder.chrono.million")] = 1000000
	onumbers[translateFunc("app.reminder.chrono.billion")] = 1000000000

	numbers[translateFunc("app.reminder.chrono.first")] = 1
	numbers[translateFunc("app.reminder.chrono.second")] = 2
	numbers[translateFunc("app.reminder.chrono.third")] = 3
	numbers[translateFunc("app.reminder.chrono.fourth")] = 4
	numbers[translateFunc("app.reminder.chrono.fifth")] = 5
	numbers[translateFunc("app.reminder.chrono.sixth")] = 6
	numbers[translateFunc("app.reminder.chrono.seventh")] = 7
	numbers[translateFunc("app.reminder.chrono.eighth")] = 8
	numbers[translateFunc("app.reminder.chrono.nineth")] = 9
	numbers[translateFunc("app.reminder.chrono.tenth")] = 10
	numbers[translateFunc("app.reminder.chrono.eleventh")] = 11
	numbers[translateFunc("app.reminder.chrono.twelveth")] = 12
	numbers[translateFunc("app.reminder.chrono.thirteenth")] = 13
	numbers[translateFunc("app.reminder.chrono.fourteenth")] = 14
	numbers[translateFunc("app.reminder.chrono.fifteenth")] = 15
	numbers[translateFunc("app.reminder.chrono.sixteenth")] = 16
	numbers[translateFunc("app.reminder.chrono.seventeenth")] = 17
	numbers[translateFunc("app.reminder.chrono.eighteenth")] = 18
	numbers[translateFunc("app.reminder.chrono.nineteenth")] = 19

	tnumbers[translateFunc("app.reminder.chrono.twenteth")] = 20
	tnumbers[translateFunc("app.reminder.chrono.twentyfirst")] = 21
	tnumbers[translateFunc("app.reminder.chrono.twentysecond")] = 22
	tnumbers[translateFunc("app.reminder.chrono.twentythird")] = 23
	tnumbers[translateFunc("app.reminder.chrono.twentyfourth")] = 24
	tnumbers[translateFunc("app.reminder.chrono.twentyfifth")] = 25
	tnumbers[translateFunc("app.reminder.chrono.twentysixth")] = 26
	tnumbers[translateFunc("app.reminder.chrono.twentyseventh")] = 27
	tnumbers[translateFunc("app.reminder.chrono.twentyeight")] = 28
	tnumbers[translateFunc("app.reminder.chrono.twentynineth")] = 29
	tnumbers[translateFunc("app.reminder.chrono.thirteth")] = 30
	tnumbers[translateFunc("app.reminder.chrono.thirtyfirst")] = 31

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

	_, location, _, _ := a.shared(user.Id)
	cfg := a.Config()

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

func (a *App) shared(userId string) (*model.User, *time.Location, i18n.TranslateFunc, error) {

	user, uErr := a.GetUser(userId)
	if uErr != nil {
		tf, _ := i18n.Tfunc("")
		tl, _ := time.LoadLocation("")
		u := model.User{}
		return &u, tl, tf, uErr
	}

	timezone := user.GetPreferredTimezone()
	if timezone == "" {
		timezone, _ = time.Now().Zone()
	}

	location, _ := time.LoadLocation(timezone)
	translateFunc := utils.GetUserTranslations(user.Locale)

	return user, location, translateFunc, nil

}
