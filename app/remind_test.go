// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	"fmt"
	"github.com/mattermost/mattermost-server/mlog"
	"strings"
	"time"
)

const (
	UNABLE_TO_SCHEDULE_REMINDER = "unable to schedule reminder"
)

func TestInitReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
}

func TestStopReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.StopReminders()
}

func TestListReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	list := th.App.ListReminders("user_id")
	if list == "" {
		t.Fatal("list should not be empty")
	}
}

func TestDeleteReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.DeleteReminders("user_id")
}

func TestScheduleReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}
	translateFunc := utils.GetUserTranslations(user.Locale)
	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me foo in 2 seconds"
	response, err := th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	var responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 2 seconds",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "@bob foo in 4 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "@bob",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 4 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "~off-topic foo in 8 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "~off-topic",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 8 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me \"foo foo foo\" in 16 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo foo foo",
		"When":    "in 16 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me foo in 32 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 32 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me foo at 2:04 pm"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "at 2:04 pm",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me foo on monday at 12:30PM"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "on monday at 12:30PM",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me foo every wednesday at 12:30PM"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "every wednesday at 12:30PM",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me tuesday foo"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "tuesday",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}

	request.Payload = "me tomorrow foo"
	response, err = th.App.ScheduleReminder(request)
	if err != nil {
		t.Fatal(UNABLE_TO_SCHEDULE_REMINDER)
	}
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "tomorrow",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\"" + response + "\" doesn't match \"" + expectedResponse + "\"")
	}
}

func TestFindWhen(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "foo in one"
	rErr := th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo in one doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "in one" {
		t.Fatal("in one isn't correct")
	}

	request.Payload = "foo every tuesday at 10am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo every tuesday at 10am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "every tuesday at 10am" {
		t.Fatal("foo every tuesday at 10am isn't correct")
	}

	request.Payload = "foo today at noon"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo today at noon doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "today at noon" {
		t.Fatal("foo today at noon isn't correct")
	}

	request.Payload = "foo tomorrow at noon"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo tomorrow at noon doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "tomorrow at noon" {
		t.Fatal("foo tomorrow at noon isn't correct")
	}

	request.Payload = "foo monday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo monday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "monday at 11:11am" {
		t.Fatal("foo monday at 11:11am isn't correct")
	}

	request.Payload = "foo monday"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo monday doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "monday" {
		t.Fatal("foo monday isn't correct")
	}

	request.Payload = "foo tuesday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo tuesday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "tuesday at 11:11am" {
		t.Fatal("foo tuesday at 11:11am isn't correct")
	}

	request.Payload = "foo wednesday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo wednesday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "wednesday at 11:11am" {
		t.Fatal("foo wednesday at 11:11am isn't correct")
	}

	request.Payload = "foo thursday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo thursday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "thursday at 11:11am" {
		t.Fatal("foo thursday at 11:11am isn't correct")
	}

	request.Payload = "foo friday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo friday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "friday at 11:11am" {
		t.Fatal("foo friday at 11:11am isn't correct")
	}

	request.Payload = "foo saturday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo saturday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "saturday at 11:11am" {
		t.Fatal("foo saturday at 11:11am isn't correct")
	}

	request.Payload = "foo sunday at 11:11am"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo sunday at 11:11am doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "sunday at 11:11am" {
		t.Fatal("foo sunday at 11:11am isn't correct")
	}

	request.Payload = "foo at 2:04 pm"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo at 2:04 pm doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "at 2:04 pm" {
		t.Fatal("foo at 2:04 pm isn't correct")
	}

	request.Payload = "foo at noon every monday"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("foo at noon every monday doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "at noon every monday" {
		t.Fatal("foo at noon every monday isn't correct")
	}

	request.Payload = "tomorrow"
	rErr = th.App.findWhen(request)
	if rErr != nil {
		mlog.Error(rErr.Error())
		t.Fatal("tomorrow doesn't parse")
	}
	if strings.Trim(request.Reminder.When, " ") != "tomorrow" {
		t.Fatal("tomorrow isn't correct")
	}

}

func TestIn(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	when := "in one second"
	times, iErr := th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in one second doesn't parse")
	}
	var duration time.Duration
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Second {
		t.Fatal("in one second isn't correct")
	}

	when = "in 712 minutes"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in 712 minutes doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Minute*time.Duration(712) {
		t.Fatal("in 712 minutes isn't correct")
	}

	when = "in three hours"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in three hours doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour*time.Duration(3) {
		t.Fatal("in three hours isn't correct")
	}

	when = "in 2 days"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in 2 days doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour*time.Duration(24)*time.Duration(2) {
		t.Fatal("in 2 days isn't correct")
	}

	when = "in 90 weeks"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in 90 weeks doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour*time.Duration(24)*time.Duration(7)*time.Duration(90) {
		t.Fatal("in 90 weeks isn't correct")
	}

	when = "in 4 months"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in 4 months doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour*time.Duration(24)*time.Duration(30)*time.Duration(4) {
		t.Fatal("in 4 months isn't correct")
	}

	when = "in one year"
	times, iErr = th.App.in(when, user)
	if iErr != nil {
		t.Fatal("in one year doesn't parse")
	}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour*time.Duration(24)*time.Duration(365) {
		t.Fatal("in one year isn't correct")
	}

}

func TestAt(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	when := "at noon"
	times, iErr := th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at noon doesn't parse")
	}
	if times[0].Hour() != 12 {
		t.Fatal("at noon isn't correct")
	}

	when = "at midnight"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at midnight doesn't parse")
	}
	if times[0].Hour() != 0 {
		t.Fatal("at midnight isn't correct")
	}

	when = "at two"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at two doesn't parse")
	}
	if times[0].Hour() != 2 && times[0].Hour() != 14 {
		t.Fatal("at two isn't correct")
	}

	when = "at 7"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 7 doesn't parse")
	}
	if times[0].Hour() != 7 && times[0].Hour() != 19 {
		t.Fatal("at 7 isn't correct")
	}

	when = "at 12:30pm"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 12:30pm doesn't parse")
	}
	if times[0].Hour() != 12 && times[0].Minute() != 30 {
		t.Fatal("at 12:30pm isn't correct")
	}

	when = "at 7:12 pm"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 7:12 pm doesn't parse")
	}
	if times[0].Hour() != 19 && times[0].Minute() != 12 {
		t.Fatal("at 7:12 pm isn't correct")
	}

	when = "at 8:05 PM"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 8:05 PM doesn't parse")
	}
	if times[0].Hour() != 10 && times[0].Minute() != 5 {
		t.Fatal("at 8:05 PM isn't correct")
	}

	when = "at 9:52 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 9:52 am doesn't parse")
	}
	if times[0].Hour() != 9 && times[0].Minute() != 52 {
		t.Fatal("at 9:52 am isn't correct")
	}

	when = "at 9:12"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 9:12 doesn't parse")
	}
	if times[0].Hour() != 9 && times[0].Hour() != 21 && times[0].Minute() != 12 {
		t.Fatal("at 9:12 isn't correct")
	}

	when = "at 17:15"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 17:15 doesn't parse")
	}
	if times[0].Hour() != 17 && times[0].Minute() != 15 {
		t.Fatal("at 17:15 isn't correct")
	}

	when = "at 930am"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 930am doesn't parse")
	}
	if times[0].Hour() != 9 && times[0].Minute() != 30 {
		t.Fatal("at 930am isn't correct")
	}

	when = "at 1230 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 1230 am doesn't parse")
	}
	if times[0].Hour() != 0 && times[0].Minute() != 30 {
		t.Fatal("at 1230 am isn't correct")
	}

	when = "at 5PM"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 5PM doesn't parse")
	}
	if times[0].Hour() != 17 && times[0].Minute() != 0 {
		t.Fatal("at 5PM isn't correct")
	}

	when = "at 4 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 4 am doesn't parse")
	}
	if times[0].Hour() != 4 && times[0].Minute() != 0 {
		t.Fatal("at 4 am isn't correct")
	}

	when = "at 1400"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 1400 doesn't parse")
	}
	if times[0].Hour() != 14 && times[0].Minute() != 0 {
		t.Fatal("at 1400 isn't correct")
	}

	when = "at 11:00 every Thursday"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 11:00 every Thursday doesn't parse")
	}
	if times[0].Hour() != 11 && times[0].Hour() != 23 && times[0].Weekday().String() != "Thursday" {
		t.Fatal("at 11:00 every Thursday isn't correct")
	}

	when = "at 3pm every day"
	times, iErr = th.App.at(when, user)
	if iErr != nil {
		t.Fatal("at 3pm every day doesn't parse")
	}
	if times[0].Hour() != 15 {
		t.Fatal("at 3pm every day isn't correct")
	}

}

func TestOn(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	when := "on Monday"
	times, iErr := th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Monday doesn't parse")
	}
	mlog.Info(fmt.Sprintf("%v", times[0]))
	mlog.Info(times[0].Weekday().String())
	if times[0].Weekday().String() != "Monday" {
		t.Fatal("on Monday isn't correct")
	}

	when = "on Tuesday"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Tuesday doesn't parse")
	}
	if times[0].Weekday().String() != "Tuesday" {
		t.Fatal("on Tuesday isn't correct")
	}

	when = "on Wednesday"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Wednesday doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("on Wednesday isn't correct")
	}

	when = "on Thursday"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Thursday doesn't parse")
	}
	if times[0].Weekday().String() != "Thursday" {
		t.Fatal("on Thursday isn't correct")
	}

	when = "on Friday"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Friday doesn't parse")
	}
	if times[0].Weekday().String() != "Friday" {
		t.Fatal("on Friday isn't correct")
	}

	when = "on Mondays"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Mondays doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" {
		t.Fatal("on Mondays isn't correct")
	}

	when = "on Tuesdays at 11:15"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Tuesdays at 11:15 doesn't parse")
	}
	if times[0].Weekday().String() != "Tuesday" {
		t.Fatal("on Tuesdays at 11:15 isn't correct")
	}

	when = "on Wednesdays"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Wednesdays doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("on Wednesdays isn't correct")
	}

	when = "on Thursdays"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Thursdays doesn't parse")
	}
	if times[0].Weekday().String() != "Thursday" {
		t.Fatal("on Thursdays isn't correct")
	}

	when = "on Fridays"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on Fridays doesn't parse")
	}
	if times[0].Weekday().String() != "Friday" {
		t.Fatal("on Fridays isn't correct")
	}

	when = "on mon"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on mon doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" {
		t.Fatal("on mon isn't correct")
	}

	when = "on wED"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on wED doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("on wED isn't correct")
	}

	when = "on tuesday at noon"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on tuesday at noon doesn't parse")
	}
	if times[0].Weekday().String() != "Tuesday" && times[0].Hour() != 12 {
		t.Fatal("on tuesday at noon isn't correct")
	}

	when = "on sunday at 3:42am"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on sunday at 3:42am doesn't parse")
	}
	if times[0].Weekday().String() != "Sunday" && times[0].Hour() != 3 && times[0].Minute() != 42 {
		t.Fatal("on sunday at 3:42am isn't correct")
	}

	when = "on December 15"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on December 15 doesn't parse")
	}
	if times[0].Month().String() != "December" && times[0].Day() != 15 {
		t.Fatal("on December 15 isn't correct")
	}

	when = "on jan 12"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on jan 12 doesn't parse")
	}
	if times[0].Month().String() != "January" && times[0].Day() != 12 {
		t.Fatal("on jan 12 isn't correct")
	}

	when = "on July 12th"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on July 12th doesn't parse")
	}
	if times[0].Month().String() != "July" && times[0].Day() != 12 {
		t.Fatal("on July 12th isn't correct")
	}

	when = "on March 22nd"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on March 22nd doesn't parse")
	}
	if times[0].Month().String() != "March" && times[0].Day() != 22 {
		t.Fatal("on March 22nd isn't correct")
	}

	when = "on March 17 at 5:41pm"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on March 17 at 5:41pm doesn't parse")
	}
	if times[0].Month().String() != "March" && times[0].Day() != 17 && times[0].Hour() != 17 && times[0].Minute() != 41 {
		t.Fatal("on March 17 at 5:41pm isn't correct")
	}

	when = "on September 7th 2020"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on September 7th 2019 doesn't parse")
	}
	if times[0].Month().String() != "September" && times[0].Day() != 7 {
		t.Fatal("on September 7th 2019 isn't correct")
	}

	when = "on April 17 2020"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on April 17 2020 doesn't parse")
	}
	if times[0].Month().String() != "April" && times[0].Day() != 17 {
		t.Fatal("on April 17 2020 isn't correct")
	}

	when = "on April 9 2020 at 11am"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on April 9 2020 at 11am doesn't parse")
	}
	if times[0].Month().String() != "April" && times[0].Day() != 20 && times[0].Hour() != 11 {
		t.Fatal("on April 9 2020 at 11am isn't correct")
	}

	when = "on auguSt tenth 2019"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on auguSt tenth 2019 doesn't parse")
	}
	if times[0].Month().String() != "August" && times[0].Day() != 10 {
		t.Fatal("on auguSt tenth 2019 isn't correct")
	}

	when = "on 7"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 7 doesn't parse")
	}
	if times[0].Day() != 7 {
		t.Fatal("on 7 isn't correct")
	}

	when = "on 7th"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 7th doesn't parse")
	}
	if times[0].Day() != 7 {
		t.Fatal("on 7th isn't correct")
	}

	when = "on seven"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on seven doesn't parse")
	}
	if times[0].Day() != 7 {
		t.Fatal("on seven isn't correct")
	}

	when = "on 1/17/20"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 1/17/20 doesn't parse")
	}
	if times[0].Year() != 2020 && times[0].Month() != 1 && times[0].Day() != 17 {
		t.Fatal("on 1/17/20 isn't correct")
	}

	when = "on 12/17/2020"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 12/17/2020 doesn't parse")
	}
	if times[0].Year() != 2020 && times[0].Month() != 12 && times[0].Day() != 17 {
		t.Fatal("on 12/17/2020 isn't correct")
	}

	when = "on 12/1"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 12/1 doesn't parse")
	}
	if times[0].Month() != 12 && times[0].Day() != 1 {
		t.Fatal("on 12/1 isn't correct")
	}

	when = "on 5-17-20"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 5-17-20 doesn't parse")
	}
	if times[0].Month() != 5 && times[0].Day() != 17 {
		t.Fatal("on 5-17-20 isn't correct")
	}

	when = "on 12-5-2020"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 12-5-2020 doesn't parse")
	}
	if times[0].Month() != 12 && times[0].Day() != 5 {
		t.Fatal("on 12-5-2020 isn't correct")
	}

	when = "on 12-12"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 12-12 doesn't parse")
	}
	if times[0].Month() != 12 && times[0].Day() != 12 {
		t.Fatal("on 12-12 isn't correct")
	}

	when = "on 1-1 at midnight"
	times, iErr = th.App.on(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("on 1-1 at midnight doesn't parse")
	}
	if times[0].Month() != 1 && times[0].Day() != 1 && times[0].Hour() != 0 {
		t.Fatal("on 1-1 at midnight isn't correct")
	}

}

func TestEvery(t *testing.T) {

	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	when := "every Thursday"
	times, iErr := th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every Thursday doesn't parse")
	}
	if times[0].Weekday().String() != "Thursday" {
		t.Fatal("every Thursday isn't correct")
	}

	when = "every day"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every day doesn't parse")
	}
	if times[0].Weekday().String() != time.Now().AddDate(0, 0, 1).Weekday().String() {
		t.Fatal("every day isn't correct")
	}

	when = "every 12/18"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every 12/18 doesn't parse")
	}
	if times[0].Month() != 12 && times[0].Year() != 2018 {
		t.Fatal("every 12/18 isn't correct")
	}

	when = "every January 25"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every January 25 doesn't parse")
	}
	if times[0].Month() != 1 && times[0].Day() != 25 {
		t.Fatal("every January 25 isn't correct")
	}

	when = "every other Wednesday"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every other Wednesday doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("every other Wednesday isn't correct")
	}

	when = "every day at 11:32am"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every day at 11:32am doesn't parse")
	}
	if times[0].Hour() != 11 && times[0].Minute() != 32 {
		t.Fatal("every day at 11:32am isn't correct")
	}

	when = "every 5/5 at 7"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every 5/5 at 7 doesn't parse")
	}
	if times[0].Month() != 5 && times[0].Day() != 5 && times[0].Hour() != 7 {
		t.Fatal("every 5/5 at 7 isn't correct")
	}

	when = "every 7/20 at 1100"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every 7/20 at 1100 doesn't parse")
	}
	if times[0].Month() != 7 && times[0].Day() != 20 && (times[0].Hour() != 11 || times[0].Hour() != 23) {
		t.Fatal("every 7/20 at 1100 isn't correct")
	}

	when = "every Monday at 7:32am"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every Monday at 7:32am doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" && (times[0].Hour() != 7 || times[0].Hour() != 32) {
		t.Fatal("every Monday at 7:32am isn't correct")
	}

	when = "every monday and wednesday"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every monday and wednesday doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" && times[1].Weekday().String() != "Wednesday" {
		t.Fatal("every monday and wednesday isn't correct")
	}

	when = "every wednesday, thursday"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every  wednesday, thursday doesn't parse")
	}
	//mlog.Info(fmt.Sprintf("%v", times[0]))
	if times[0].Weekday().String() != "Monday" && times[1].Weekday().String() != "Thursday" {
		t.Fatal("every wednesday, thursday isn't correct")
	}

	when = "every other friday and saturday"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every  wednesday, thursday doesn't parse")
	}
	if times[0].Weekday().String() != "Friday" && times[1].Weekday().String() != "Saturday" {
		t.Fatal("every wednesday, thursday isn't correct")
	}

	when = "every monday and wednesday at 1:39am"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every monday and wednesday at 1:39am doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" && times[1].Weekday().String() != "Wednesday" && times[0].Hour() != 13 && times[0].Minute() != 39 {
		t.Fatal("every monday and wednesday at 1:39am isn't correct")
	}

	when = "every monday, tuesday and sunday at 11:00"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every monday, tuesday and sunday at 11:00 doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" && times[1].Weekday().String() != "Tuesday" && times[2].Weekday().String() != "Sunday" && times[0].Hour() != 11 {
		t.Fatal("every monday, tuesday and sunday at 11:00 isn't correct")
	}

	when = "every monday, tuesday at 2pm"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every monday, tuesday at 2pm doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" && times[1].Weekday().String() != "Tuesday" && times[0].Hour() != 14 {
		t.Fatal("every monday, tuesday at 2pm isn't correct")
	}

	when = "every 1/30 and 9/30 at noon"
	times, iErr = th.App.every(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("every 1/30 and 9/30 at noon doesn't parse")
	}
	if times[0].Month() != 1 && times[0].Day() != 30 && times[1].Month() != 9 && times[1].Day() != 30 && times[0].Hour() != 12 {
		t.Fatal("every 1/30 and 9/30 at noon isn't correct")
	}

}

func TestFreeForm(t *testing.T) {

	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil {
		t.Fatal("remindbot doesn't exist")
	}

	when := "monday"
	times, iErr := th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("monday doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" {
		t.Fatal("monday isn't correct")
	}

	when = "tuesday at 9:34pm"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("tuesday at 9:34pm doesn't parse")
	}
	if times[0].Weekday().String() != "Tuesday" && times[0].Hour() != 21 && times[0].Minute() != 34 {
		t.Fatal("tuesday at 9:34pm isn't correct")
	}

	when = "wednesday"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("wednesday doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("wednesday isn't correct")
	}

	when = "thursday at noon"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("thursday at noon doesn't parse")
	}
	if times[0].Weekday().String() != "Thursday" && times[0].Hour() != 12 {
		t.Fatal("thursday at noon isn't correct")
	}

	when = "friday"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("friday doesn't parse")
	}
	if times[0].Weekday().String() != "Friday" {
		t.Fatal("friday isn't correct")
	}

	when = "saturday"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("saturday doesn't parse")
	}
	if times[0].Weekday().String() != "Saturday" {
		t.Fatal("saturday isn't correct")
	}

	when = "sunday at 4:20pm"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("sunday at 4:20pm doesn't parse")
	}
	if times[0].Weekday().String() != "Sunday" && times[0].Hour() != 16 && times[0].Minute() != 20 {
		t.Fatal("sunday at 4:20pm isn't correct")
	}

	when = "today at 3pm"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("today at 3pm doesn't parse")
	}
	//mlog.Info(fmt.Sprintf("%v", times[0]))
	if times[0].Hour() != 15 {
		t.Fatal("today at 3pm isn't correct")
	}

	when = "tomorrow"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("tomorrow doesn't parse")
	}
	if times[0].Weekday().String() != time.Now().AddDate(0, 0, 1).Weekday().String() {
		t.Fatal("tomorrow isn't correct")
	}

	when = "tomorrow at 4pm"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("tomorrow at 4pm doesn't parse")
	}
	if times[0].Weekday().String() != time.Now().AddDate(0, 0, 1).Weekday().String() && times[0].Hour() != 16 {
		t.Fatal("tomorrow at 4pm isn't correct")
	}

	when = "everyday"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("everyday doesn't parse")
	}
	if times[0].Weekday().String() != time.Now().AddDate(0, 0, 1).Weekday().String() {
		t.Fatal("everyday isn't correct")
	}

	when = "everyday at 3:23am"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("everyday at 3:23am doesn't parse")
	}
	if times[0].Weekday().String() != time.Now().AddDate(0, 0, 1).Weekday().String() && times[0].Hour() != 3 && times[0].Minute() != 23 {
		t.Fatal("everyday at 3:23am isn't correct")
	}

	when = "mondays"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("mondays doesn't parse")
	}
	if times[0].Weekday().String() != "Monday" {
		t.Fatal("mondays isn't correct")
	}

	when = "tuesdays"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("tuesdays doesn't parse")
	}
	if times[0].Weekday().String() != "Tuesday" {
		t.Fatal("tuesdays isn't correct")
	}

	when = "wednesdays"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("wednesdays doesn't parse")
	}
	if times[0].Weekday().String() != "Wednesday" {
		t.Fatal("wednesdays isn't correct")
	}

	when = "thursdays"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("thursdays doesn't parse")
	}
	if times[0].Weekday().String() != "Thursday" {
		t.Fatal("thursdays isn't correct")
	}

	when = "fridays"
	times, iErr = th.App.freeForm(when, user)
	if iErr != nil {
		mlog.Error(iErr.Error())
		t.Fatal("fridays doesn't parse")
	}
	if times[0].Weekday().String() != "Friday" {
		t.Fatal("fridays isn't correct")
	}

}
