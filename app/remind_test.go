// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

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


	request.Payload = "me \"foo foo foo\" in 2 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo foo foo",
		"When":    "in 2 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo in 5 seconds"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "in 5 seconds",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo at 2:04 pm"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "at 2:04PM",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}


	request.Payload = "me foo on monday at 12:30PM"
	response, err = th.App.ScheduleReminder(request)
	if err != nil { t.Fatal(UNABLE_TO_SCHEDULE_REMINDER) }
	responseParameters = map[string]interface{}{
		"Target":  "You",
		"UseTo":   "",
		"Message": "foo",
		"When":    "on monday at 12:30PM",
	}
	expectedResponse = translateFunc("app.reminder.response", responseParameters)
	if response != expectedResponse {
		t.Fatal("\""+response+"\" doesn't match \""+ expectedResponse+"\"")
	}

	//TODO TEST Every

	//TODO TEST Outlier
}


func TestIn(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }


	when := "in one second"
	times, iErr := th.App.in(when, user)
	if iErr != nil { t.Fatal("in one second doesn't parse")}
	var duration time.Duration
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Second {
		t.Fatal("in one second isn't correct")
	}


	when = "in 712 minutes"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in 712 minutes doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Minute * time.Duration(712) {
		t.Fatal("in 712 minutes isn't correct")
	}


	when = "in three hours"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in three hours doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour * time.Duration(3) {
		t.Fatal("in three hours isn't correct")
	}


	when = "in 2 days"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in 2 days doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour * time.Duration(24) * time.Duration(2) {
		t.Fatal("in 2 days isn't correct")
	}


	when = "in 90 weeks"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in 90 weeks doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour * time.Duration(24) * time.Duration(7) * time.Duration(90) {
		t.Fatal("in 90 weeks isn't correct")
	}


	when = "in 4 months"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in 4 months doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour * time.Duration(24) * time.Duration(30) * time.Duration(4) {
		t.Fatal("in 4 months isn't correct")
	}


	when = "in one year"
	times, iErr = th.App.in(when, user)
	if iErr != nil { t.Fatal("in one year doesn't parse")}
	duration = times[0].Round(time.Second).Sub(time.Now().Round(time.Second))
	if duration != time.Hour * time.Duration(24) * time.Duration(365)  {
		t.Fatal("in one year isn't correct")
	}

}

func TestAt(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
	user, uErr := th.App.GetUserByUsername("remindbot")
	if uErr != nil { t.Fatal("remindbot doesn't exist") }


	when := "at noon"
	times, iErr := th.App.at(when, user)
	if iErr != nil { t.Fatal("at noon doesn't parse")}
	if times[0].Hour() != 12 {
		t.Fatal("at noon isn't correct")
	}


	when = "at midnight"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at midnight doesn't parse")}
	if times[0].Hour() != 0 {
		t.Fatal("at midnight isn't correct")
	}


	when = "at two"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at two doesn't parse")}
	if times[0].Hour() != 2 && times[0].Hour() != 14 {
		t.Fatal("at two isn't correct")
	}


	when = "at 7"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 7 doesn't parse")}
	if times[0].Hour() != 7 && times[0].Hour() != 19 {
		t.Fatal("at 7 isn't correct")
	}


	when = "at 12:30pm"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 12:30pm doesn't parse")}
	if times[0].Hour() != 12 && times[0].Minute() != 30 {
		t.Fatal("at 12:30pm isn't correct")
	}


	when = "at 7:12 pm"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 7:12 pm doesn't parse")}
	if times[0].Hour() != 19 && times[0].Minute() != 12 {
		t.Fatal("at 7:12 pm isn't correct")
	}


	when = "at 8:05 PM"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 8:05 PM doesn't parse")}
	if times[0].Hour() != 10 && times[0].Minute() != 5 {
		t.Fatal("at 8:05 PM isn't correct")
	}


	when = "at 9:52 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 9:52 am doesn't parse")}
	if times[0].Hour() != 9 && times[0].Minute() != 52 {
		t.Fatal("at 9:52 am isn't correct")
	}


	when = "at 9:12"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 9:12 doesn't parse")}
	if times[0].Hour() != 9 && times[0].Hour() != 21 && times[0].Minute() != 12 {
		t.Fatal("at 9:12 isn't correct")
	}


	when = "at 17:15"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 17:15 doesn't parse") }
	if times[0].Hour() != 17 && times[0].Minute() != 15 {
		t.Fatal("at 17:15 isn't correct")
	}


	when = "at 930am"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 930am doesn't parse") }
	if times[0].Hour() != 9 && times[0].Minute() != 30 {
		t.Fatal("at 930am isn't correct")
	}


	when = "at 1230 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 1230 am doesn't parse") }
	if times[0].Hour() != 0 && times[0].Minute() != 30 {
		t.Fatal("at 1230 am isn't correct")
	}


	when = "at 5PM"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 5PM doesn't parse") }
	if times[0].Hour() != 17 && times[0].Minute() != 0 {
		t.Fatal("at 5PM isn't correct")
	}


	when = "at 4 am"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 4 am doesn't parse") }
	if times[0].Hour() != 4 && times[0].Minute() != 0 {
		t.Fatal("at 4 am isn't correct")
	}


	when = "at 1400"
	times, iErr = th.App.at(when, user)
	if iErr != nil { t.Fatal("at 1400 doesn't parse") }
	if times[0].Hour() != 14 && times[0].Minute() != 0 {
		t.Fatal("at 1400 isn't correct")
	}

	//TODO
	/*
	when = "at 11:00 every Thursday";

	when = "at 3pm every day";
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
