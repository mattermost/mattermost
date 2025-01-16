package app

import (
	"fmt"
	"encoding/json"
)

const (
	// Login Events
	TopicUserLoggedIn = "user_logged_in"
)

// UserLoggedInEvent represents the payload for a login event
type UserLoggedInEvent struct {
	UserID    string `json:"user_id"`
	UserAgent string `json:"user_agent"`
	IPAddress string `json:"ip_address"`
}

// Event schemas
var (
	userLoggedInSchema = []byte(`{
		"type": "object",
		"properties": {
			"user_id": {"type": "string"},
			"user_agent": {"type": "string"},
			"ip_address": {"type": "string"}
		},
		"required": ["user_id", "user_agent", "ip_address"]
	}`)
)

func init() {
	// Register all event topics
	registerEvents()
}

// registerEvents registers all system bus events and their schemas
func registerEvents() {
	// Login events
	if err := systemBusRegisterOnce(TopicUserLoggedIn, "Event emitted when a user successfully logs in", userLoggedInSchema); err != nil {
		panic("failed to register user_logged_in topic: " + err.Error())
	}
}

// systemBusRegisterOnce ensures a topic is only registered once
func systemBusRegisterOnce(name, description string, schema json.RawMessage) error {
	if sysBus := app.Srv().SystemBus(); sysBus != nil {
		if err := sysBus.RegisterTopic(name, description, schema); err != nil {
			// Ignore already registered errors
			if err.Error() != fmt.Sprintf("topic %q already registered", name) {
				return err
			}
		}
	}
	return nil
}
