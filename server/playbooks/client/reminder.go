package client

type ReminderResetPayload struct {
	NewReminderSeconds int `json:"new_reminder_seconds"`
}
