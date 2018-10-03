package model

import (
	"strings"
	"testing"
)

func TestReminder(t *testing.T) {

	reminder := Reminder{NewId(), NewId(), NewId(), "me", "foo", "at 10am", ""}
	json := reminder.ToJson()
	reminder2 := ReminderFromJson(strings.NewReader(json))

	if reminder.Id != reminder2.Id {
		t.Fatal("Id should have matched")
	}

	if reminder.TeamId != reminder2.TeamId {
		t.Fatal("TeamId should have matched")
	}

	if reminder.UserId != reminder2.UserId {
		t.Fatal("UserId should have matched")
	}

	if reminder.Target != reminder2.Target {
		t.Fatal("Target should have matched")
	}

	if reminder.Message != reminder2.Message {
		t.Fatal("Message should have matched")
	}

	if reminder.When != reminder2.When {
		t.Fatal("When should have matched")
	}

	if reminder.Completed != reminder2.Completed {
		t.Fatal("Completed should have matched")
	}
}

func TestOccurrence(t *testing.T) {

	occurrence := Occurrence{NewId(), NewId(), NewId(), "FOO", "BAR", "SNOOZE"}
	json := occurrence.ToJson()
	occurrence2 := OccurrenceFromJson(strings.NewReader(json))

	if occurrence.Id != occurrence2.Id {
		t.Fatal("Id should have matched")
	}

	if occurrence.UserId != occurrence2.UserId {
		t.Fatal("UserId should have matched")
	}

	if occurrence.ReminderId != occurrence2.ReminderId {
		t.Fatal("ReminderId should have matched")
	}

	if occurrence.Repeat != occurrence2.Repeat {
		t.Fatal("Repeat should have matched")
	}

	if occurrence.Occurrence != occurrence2.Occurrence {
		t.Fatal("Occurrence should have matched")
	}

	if occurrence.Snoozed != occurrence2.Snoozed {
		t.Fatal("Snoozed should have matched")
	}
}

func TestReminderRequest(t *testing.T) {

	reminder := Reminder{NewId(), NewId(), NewId(), "me", "foo", "at 10am", ""}
	occurrence := Occurrence{NewId(), NewId(), NewId(), "FOO", "BAR", "SNOOZE"}
	request := ReminderRequest{NewId(), NewId(), "foo in 2 seconds", reminder, []Occurrence{occurrence}}
	json := request.ToJson()
	request2 := ReminderRequestFromJson(strings.NewReader(json))

	if request.TeamId != request2.TeamId {
		t.Fatal("TeamId should have matched")
	}

	if request.UserId != request2.UserId {
		t.Fatal("UserId should have matched")
	}

	if request.Payload != request2.Payload {
		t.Fatal("Payload should have matched")
	}

	if request.Reminder != request2.Reminder {
		t.Fatal("Reminder should have matched")
	}

	if request.Occurrences[0] != request2.Occurrences[0] {
		t.Fatal("Occurrences should have matched")
	}

}
