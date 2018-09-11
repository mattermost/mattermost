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

}

func TestScheduleReminders_On(t *testing.T) {
	th := Setup()
	defer th.TearDown()


	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }
	translateFunc := utils.GetUserTranslations(user.Locale)

	request := &model.ReminderRequest{}
	request.UserId = user.Id

	request.Payload = "me foo on monday at 12:30PM"
	response, err := th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters := map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "on monday at 12:30PM",
	}
	expectedResponse := translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}

}

func TestScheduleReminders_Every(t *testing.T) {
	th := Setup()
	defer th.TearDown()
}

func TestScheduleReminders_Outlier(t *testing.T) {
	th := Setup()
	defer th.TearDown()
}

func TestIn(t *testing.T) {
	th := Setup()
	defer th.TearDown()
	/*

        when = "in one second";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusSeconds(1).toString(), testDate.toString());

        when = "in 712 minutes";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusMinutes(712).toString(), testDate.toString());

        when = "in three hours";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusHours(3).toString(), testDate.toString());

        when = "in 2 days";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusDays(2).toString(), testDate.toString());

        when = "in ninety weeks";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusWeeks(90).toString(), testDate.toString());

        when = "in 4 months";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusMonths(4).toString(), testDate.toString());

        when = "in one year";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        assertEquals(checkDate.plusYears(1).toString(), testDate.toString());

	 */
}

func TestAt(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	/*
	        when = "at noon";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(12, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at midnight";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(0, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at two";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(2, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusHours(12).equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 7";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(7, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusHours(12).equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 12:30pm";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(12, 30).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 7:12 pm";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(19, 12).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 8:05 PM";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(20, 5).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 9:52 am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(9, 52).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 9:12";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(9, 12).truncatedTo(ChronoUnit.SECONDS);
        checkDate2 = LocalDate.now().atTime(21, 12).truncatedTo(ChronoUnit.SECONDS);
        System.out.println("=====================D");
        System.out.println(testDate);
        System.out.println(checkDate);
        assertTrue(checkDate.equals(testDate) || checkDate.plusHours(12).equals(testDate) ||
                checkDate2.equals(testDate) || checkDate2.plusHours(12).equals(testDate));

        when = "at 17:15";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(17, 15).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 930am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(9, 30).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 1230 am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(0, 30).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 5PM";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(17, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));


        when = "at 4 am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(4, 0).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 1400";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().atTime(14, 00).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 11:00 every Thursday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY)).atTime(11, 00).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

        when = "at 3pm every day";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().plusDays(1).atTime(15, 00).truncatedTo(ChronoUnit.SECONDS);
        assertTrue(checkDate.equals(testDate) || checkDate.plusDays(1).equals(testDate));

	 */
}

func TestOn(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }

	_, err := th.App.on("on 12/18 at 1200", user)
	if err != nil { t.Fatal("on monday doesn't pass")}

	/*
	        when = "on Monday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Tuesday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Wednesday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Thursday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Friday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.FRIDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "on Mondays";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Tuesdays at 11:15";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY)).atTime(11, 15);
        assertEquals(testDate, checkDate);
        when = "on Wednesdays";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Thursdays";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        when = "on Fridays";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.FRIDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);


        when = "on mon";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "on WEDNEs";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "on tuesday at noon";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY)).atTime(12, 0);
        assertEquals(testDate, checkDate);

        when = "on sunday at 3:42am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.SUNDAY)).atTime(3, 42);
        assertEquals(testDate, checkDate);

        when = "on December 15";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("December 15 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on jan 12";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("January 12 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on July 12th";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("July 12 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on March 22";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("March 22 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on March 17 at 5:41pm";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("March 17 " + LocalDateTime.now().getYear() + " 17:41", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));


        when = "on September 7th 2019";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("September 7 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on April 17 2019";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("April 17 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on April 9 2019 at 11am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("April 9 " + LocalDateTime.now().getYear() + " 11:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));


        when = "on auguSt tenth 2019";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("August 10 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 7";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse(LocalDate.now().getMonth().name() + " 7 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusMonths(1).equals(testDate));

        when = "on 7th";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse(LocalDate.now().getMonth().name() + " 7 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusMonths(1).equals(testDate));

        when = "on seven";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse(LocalDate.now().getMonth().name() + " 7 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusMonths(1).equals(testDate));

        when = "on 1/17/18";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("1 17 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 12/17/2018";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("12 17 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 12/1";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("12 1 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 5-17-18";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("5 17 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 12-5-2018";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("12 5 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 12-12";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("12 12 2018 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));

        when = "on 1-1 at midnight";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("1 1 2018 00:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("M d yyyy HH:mm").toFormatter());
        assertTrue(checkDate.equals(testDate) || checkDate.plusYears(1).equals(testDate));


	 */



}

func TestEvery(t *testing.T) {

	/*

        when = "every Thursday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every day";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().plusDays(1).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every 12/18";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("December 18 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertEquals(testDate, checkDate);

        when = "every January 25";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("January 25 " + LocalDateTime.now().getYear() + " 09:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertEquals(testDate, checkDate);

        when = "every other Wednesday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).plusWeeks(1).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every day at 11:32am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().plusDays(1).atTime(11, 32);
        assertEquals(testDate, checkDate);

        when = "every 5/5 at 7";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("May 5 " + LocalDateTime.now().getYear() + " 07:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        checkDate2 = LocalDateTime.parse("May 5 " + LocalDateTime.now().plusYears(1).getYear() + " 07:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(testDate.equals(checkDate) || testDate.equals(checkDate2));

        when = "every 7/20 at 1100";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("July 20 " + LocalDateTime.now().getYear() + " 11:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        checkDate2 = LocalDateTime.parse("July 20 " + LocalDateTime.now().plusYears(1).getYear() + " 11:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(testDate.equals(checkDate) || testDate.equals(checkDate2));

        when = "every Monday at 7:32am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(7, 32);
        assertEquals(testDate, checkDate);

        when = "every monday and wednesday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every wednesday, thursday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY)).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every other friday and saturday";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.FRIDAY)).plusWeeks(1).atTime(9, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.SATURDAY)).plusWeeks(1).atTime(9, 0);
        assertEquals(testDate, checkDate);

        when = "every monday and wednesday at 1:39am";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(1, 39);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY)).atTime(1, 39);
        assertEquals(testDate, checkDate);

        when = "every monday, tuesday and sunday at 11:00";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(11, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY)).atTime(11, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(2);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.SUNDAY)).atTime(11, 0);
        assertEquals(testDate, checkDate);


        when = "every monday, tuesday at 2pm";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(14, 0);
        assertEquals(testDate, checkDate);
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY)).atTime(14, 0);
        assertEquals(testDate, checkDate);

        when = "every 1/30 and 9/30 at noon";
        testDate = occurrence.calculate(when).get(0);
        checkDate = LocalDateTime.parse("January 30 " + LocalDateTime.now().getYear() + " 12:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        checkDate2 = LocalDateTime.parse("January 30 " + LocalDateTime.now().plusYears(1).getYear() + " 12:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(testDate.equals(checkDate) || testDate.equals(checkDate2));
        testDate = occurrence.calculate(when).get(1);
        checkDate = LocalDateTime.parse("September 30 " + LocalDateTime.now().getYear() + " 12:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        checkDate2 = LocalDateTime.parse("September 30 " + LocalDateTime.now().plusYears(1).getYear() + " 12:00", new DateTimeFormatterBuilder()
                .parseCaseInsensitive().appendPattern("MMMM d yyyy HH:mm").toFormatter());
        assertTrue(testDate.equals(checkDate) || testDate.equals(checkDate2));

	 */
}
