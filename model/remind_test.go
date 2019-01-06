package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReminder(t *testing.T) {

	reminder := Reminder{NewId(), NewId(), NewId(), "me", "foo", "at 10am", ""}
	json := reminder.ToJson()
	reminder2 := ReminderFromJson(strings.NewReader(json))

	assert.Equal(t, reminder.Id, reminder2.Id)

	assert.Equal(t, reminder.TeamId, reminder2.TeamId)

	assert.Equal(t, reminder.UserId, reminder2.UserId)

	assert.Equal(t, reminder.Target, reminder2.Target)

	assert.Equal(t, reminder.Message, reminder2.Message)

	assert.Equal(t, reminder.When, reminder2.When)

	assert.Equal(t, reminder.Completed, reminder2.Completed)
}

func TestOccurrence(t *testing.T) {

	occurrence := Occurrence{NewId(), NewId(), NewId(), "FOO", "BAR", "SNOOZE"}
	json := occurrence.ToJson()
	occurrence2 := OccurrenceFromJson(strings.NewReader(json))

	assert.Equal(t, occurrence.Id, occurrence2.Id)

	assert.Equal(t, occurrence.UserId, occurrence2.UserId)

	assert.Equal(t, occurrence.ReminderId, occurrence2.ReminderId)

	assert.Equal(t, occurrence.Repeat, occurrence2.Repeat)

	assert.Equal(t, occurrence.Occurrence, occurrence2.Occurrence)

	assert.Equal(t, occurrence.Snoozed, occurrence2.Snoozed)
}

func TestReminderRequest(t *testing.T) {

	reminder := Reminder{NewId(), NewId(), NewId(), "me", "foo", "at 10am", ""}
	occurrence := Occurrence{NewId(), NewId(), NewId(), "FOO", "BAR", "SNOOZE"}
	request := ReminderRequest{NewId(), NewId(), "foo in 2 seconds", reminder, []Occurrence{occurrence}}
	json := request.ToJson()
	request2 := ReminderRequestFromJson(strings.NewReader(json))

	assert.Equal(t, request.TeamId, request2.TeamId)

	assert.Equal(t, request.UserId, request2.UserId)

	assert.Equal(t, request.Payload, request2.Payload)

	assert.Equal(t, request.Reminder, request2.Reminder)

	assert.Equal(t, request.Occurrences[0], request2.Occurrences[0])

}

func TestChannelReminders(t *testing.T) {
	reminder := Reminder{NewId(), NewId(), NewId(), "me", "foo", "at 10am", ""}
	occurrence := Occurrence{NewId(), NewId(), NewId(), "FOO", "BAR", "SNOOZE"}
	channelReminders := ChannelReminders{Reminders{reminder}, Occurrences{occurrence}}
	json := channelReminders.ToJson()
	channelReminders2 := ChannelRemindersFromJson(strings.NewReader(json))

	assert.Equal(t, channelReminders.Occurrences, channelReminders2.Occurrences)

	assert.Equal(t, channelReminders.Reminders, channelReminders2.Reminders)

}
