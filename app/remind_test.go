// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

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

func TestScheduleReminders_Target(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }
	translateFunc := utils.GetUserTranslations(user.Locale)

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me foo in 2 seconds"
	response, err := th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	var responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 2 seconds",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "@bob foo in 2 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "@bob",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 2 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "~off-topic foo in 2 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "~off-topic",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 2 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}

}


func TestScheduleReminders_Quotes(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }
	translateFunc := utils.GetUserTranslations(user.Locale)

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me \"foo foo foo\" in 2 seconds"
	response, err := th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	var responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo foo foo",
		"When":    "in 2 seconds",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}

}


// TODO maybe just test in function here instead of schedule reminders
func TestScheduleReminders_In(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }
	translateFunc := utils.GetUserTranslations(user.Locale)

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me foo in 5 seconds"
	response, err := th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	var responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 5 seconds",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 10 minutes"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 10 minutes",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 15 hours"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 15 hours",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 20 days"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 20 days",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 25 weeks"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 25 weeks",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 30 months"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 30 months",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 35 years"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 35 years",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}
}


func TestScheduleReminders_At(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }
	translateFunc := utils.GetUserTranslations(user.Locale)

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me foo at 2:04 pm"
	response, err := th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters := map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "at 2:04PM",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}

	// TODO get output correct and test the rest of the patterns

}

func TestScheduleReminders_On(t *testing.T) {
	th := Setup()
	defer th.TearDown()


	//user, uErr := th.App.GetUserByUsername("remindbot")
	//if uErr != nil { t.Fatal("remindbot doesn't exist") }
	//translateFunc := utils.GetUserTranslations(user.Locale)
	//
	//request := &model.ReminderRequest{}
	//request.UserId = user.Id
	//
	//request.Payload = "me foo on monday"
	//response, err := th.App.ScheduleReminder(request)
	//if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	//responseParameters := map[string]interface{}{
	//	"Target":  "You",
	//	"UseTo":   "",
	//	"Message": "foo",
	//	"When":    "on monday",
	//}
	//expectedResponse := translateFunc("app.reminder.response", responseParameters)
	//if response != expectedResponse {
	//	t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	//}

	// TODO get output correct and test the rest of the patterns

}

func TestScheduleReminders_Every(t *testing.T) {
	th := Setup()
	defer th.TearDown()
}

func TestScheduleReminders_Outlier(t *testing.T) {
	th := Setup()
	defer th.TearDown()
}
