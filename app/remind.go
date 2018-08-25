// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"time"
	"strings"
	"fmt"
	"errors"
	"strconv"

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

	t := time.Now().UTC().Round(time.Second).UnixNano()
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

func (a *App) ListReminders(userId string) (string) {

	_, _, translateFunc, sErr := a.shared(userId)

	if sErr != nil {
		return model.REMIND_EXCEPTION_TEXT
	}

	reminders := a.getReminders(userId)

	var upcomingOccurrences []model.Occurrence
	var recurringOccurrences []model.Occurrence
	var pastOccurrences []model.Occurrence

	var output string
	output = ""
	for _, reminder := range reminders {

		schan := a.Srv.Store.Remind().GetByReminder(reminder.Id)
		result := <-schan
		if result.Err != nil {
			continue
		}

		var occurrences model.Occurrences
		occurrences = result.Data.(model.Occurrences)

		if len(occurrences) > 0 {

			for _, occurrence := range occurrences {

				if reminder.Completed == emptyTime.UnixNano() &&
					(occurrence.Repeat == "" &&
						time.Unix(0, occurrence.Occurrence).After(time.Now())) ||
					(occurrence.Snoozed != emptyTime.UnixNano() && time.Unix(0, occurrence.Snoozed).After(time.Now())) {
					upcomingOccurrences = append(upcomingOccurrences, occurrence)
				}

				if occurrence.Repeat != "" &&
					time.Unix(0, occurrence.Occurrence).After(time.Now()) {
					recurringOccurrences = append(recurringOccurrences, occurrence)
				}

				if reminder.Completed == emptyTime.UnixNano() &&
					time.Unix(0, occurrence.Occurrence).Before(time.Now()) &&
					occurrence.Snoozed == emptyTime.UnixNano() {
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

func (a *App) listReminderGroup(userId string, occurrences *[]model.Occurrence, reminders *[]model.Reminder) (string) {

	_, location, translateFunc, _ := a.shared(userId)
	cfg := a.Config()

	var output string
	output = ""

	for _, occurrence := range *occurrences {

		reminder := a.findReminder(occurrence.ReminderId, reminders)

		t := time.Unix(0, occurrence.Occurrence)

		var formattedOccurrence string
		if *cfg.DisplaySettings.ExperimentalTimezone {
			formattedOccurrence = t.In(location).Format(time.UnixDate)
		} else {
			formattedOccurrence = t.Format(time.UnixDate)
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

func (a *App) findReminder(reminderId string, reminders *[]model.Reminder) (*model.Reminder) {
	for _, reminder := range *reminders {
		if reminder.Id == reminderId {
			return &reminder
		}
	}
	return &model.Reminder{}
}

func (a *App) DeleteReminders(userId string) (string) {

	_, _, translateFunc, _ := a.shared(userId)

	schan := a.Srv.Store.Remind().DeleteForUser(userId)
	if result := <-schan; result.Err != nil {
		return ""
	}
	return translateFunc("app.reminder.ok_deleted")
}

func (a *App) getReminders(userId string) ([]model.Reminder) {

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
		return model.REMIND_EXCEPTION_TEXT, nil
	}

	useTo := strings.HasPrefix(request.Reminder.Message, translateFunc("app.reminder.chrono.to"))
	var useToString string
	if useTo {
		useToString = " " + translateFunc("app.reminder.chrono.to")
	} else {
		useToString = ""
	}

	request.Reminder.Id = model.NewId()
	request.Reminder.TeamId = request.TeamId
	request.Reminder.UserId = request.UserId
	request.Reminder.Completed = emptyTime.UnixNano()

	if cErr := a.createOccurrences(request); cErr != nil {
		mlog.Error(cErr.Error())
		return model.REMIND_EXCEPTION_TEXT, nil
	}

	schan := a.Srv.Store.Remind().SaveReminder(&request.Reminder)
	if result := <-schan; result.Err != nil {
		mlog.Error(result.Err.Message)
		return model.REMIND_EXCEPTION_TEXT, nil
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

func (a *App) parseRequest(request *model.ReminderRequest) (error) {

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

func (a *App) createOccurrences(request *model.ReminderRequest) (error) {

	user, _, translateFunc, _ := a.shared(request.UserId)

	if strings.HasPrefix(request.Reminder.When, translateFunc("app.reminder.chrono.in")) {

		occurrences, inErr := a.in(request.Reminder.When, user)
		if inErr != nil {
			mlog.Error(inErr.Error())
			return inErr
		}

		for _, o := range occurrences {

			occurrence := &model.Occurrence{
				model.NewId(),
				request.UserId,
				request.Reminder.Id,
				"",
				o.UnixNano(),
				emptyTime.UnixNano(),
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

	// TODO handle the other when prefix's

	return errors.New("unable to create occurrences")
}

func (a *App) findWhen(request *model.ReminderRequest) (error) {

	_, _, translateFunc, _ := a.shared(request.UserId)

	inSplit := strings.Split(request.Payload, " "+translateFunc("app.reminder.chrono.in")+" ")
	if len(inSplit) == 2 {
		request.Reminder.When = translateFunc("app.reminder.chrono.in") + " " + inSplit[len(inSplit)-1]
		return nil
	}

	inSplit = strings.Split(request.Payload, " "+translateFunc("app.reminder.chrono.at")+" ")
	if len(inSplit) == 2 {
		request.Reminder.When = translateFunc("app.reminder.chrono.at") + " " + inSplit[len(inSplit)-1]
		return nil
	}

	//TODO the additional when patterns

	return errors.New("unable to find when")
}

func (a *App) in(when string, user *model.User) (times []time.Time, err error) {

	whenSplit := strings.Split(when, " ")
	value := whenSplit[1]
	units := whenSplit[len(whenSplit)-1]

	_, location, translateFunc, _ := a.shared(user.Id)
	cfg := a.Config()

	switch units {
	case translateFunc("app.reminder.chrono.seconds"),
		translateFunc("app.reminder.chrono.second"),
		translateFunc("app.reminder.chrono.secs"),
		translateFunc("app.reminder.chrono.sec"),
		translateFunc("app.reminder.chrono.s"):

		i, _ := strconv.Atoi(value)

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Second*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Second*time.Duration(i)))
		}

		return times, nil

	case translateFunc("app.reminder.chrono.minutes"),
		translateFunc("app.reminder.chrono.minute"),
		translateFunc("app.reminder.chrono.min"):

		i, _ := strconv.Atoi(value)

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

		i, _ := strconv.Atoi(value)

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*time.Duration(i)))
		}

		return times, nil

	case translateFunc("app.reminder.chrono.days"),
		translateFunc("app.reminder.chrono.day"),
		translateFunc("app.reminder.chrono.d"):

		i, _ := strconv.Atoi(value)

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

		i, _ := strconv.Atoi(value)

		if *cfg.DisplaySettings.ExperimentalTimezone {
			times = append(times, time.Now().In(location).Round(time.Second).Add(time.Hour*24*7*time.Duration(i)))
		} else {
			times = append(times, time.Now().Round(time.Second).Add(time.Hour*24*7*time.Duration(i)))
		}

		return times, nil

	case translateFunc("app.reminder.chrono.months"),
		translateFunc("app.reminder.chrono.month"),
		translateFunc("app.reminder.chrono.m"):

		i, _ := strconv.Atoi(value)

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

		i, _ := strconv.Atoi(value)

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

	//  *  at [(noon|midnight|one..twelve|00:00am/pm|0000)] (every) [day|date]
	//at midnight
	//at noon
	//handle patterns
	whenSplit := strings.Split(when, " ")
	value := whenSplit[1]
	units := whenSplit[len(whenSplit)-1]

	_, location, translateFunc, _ := a.shared(user.Id)
	cfg := a.Config()

	switch units {

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
