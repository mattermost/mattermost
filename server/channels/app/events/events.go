package events

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/v8/platform/services/systembus"
)

const (
	// Login Events
	TopicUserLoggedIn    = "user_logged_in"
	TopicUserLoginFailed = "user_login_failed"
)

// UserLoggedInEvent represents the payload for a login event
type UserLoggedInEvent struct {
	UserID    string `json:"user_id"`
	UserAgent string `json:"user_agent"`
	IPAddress string `json:"ip_address"`
}

func (e *UserLoggedInEvent) Serialize() []byte {
	data, _ := json.Marshal(e)
	return data
}

// UserLoginFailedEvent represents the payload for a failed login attempt
type UserLoginFailedEvent struct {
	LoginID   string `json:"login_id"`
	UserAgent string `json:"user_agent"`
	IPAddress string `json:"ip_address"`
	Reason    string `json:"reason"`
}

func (e *UserLoginFailedEvent) Serialize() []byte {
	data, _ := json.Marshal(e)
	return data
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

	userLoginFailedSchema = []byte(`{
		"type": "object",
		"properties": {
			"login_id": {"type": "string"},
			"user_agent": {"type": "string"},
			"ip_address": {"type": "string"},
			"reason": {"type": "string"}
		},
		"required": ["login_id", "user_agent", "ip_address", "reason"]
	}`)
)

// InitSystemEventBus registers all system bus events and their schemas
func InitSystemBusEvents(bus *systembus.SystemBus) error {
	if bus == nil {
		return nil
	}

	// Login events
	if err := bus.RegisterTopic(TopicUserLoggedIn, "Event emitted when a user successfully logs in", userLoggedInSchema); err != nil {
		return err
	}

	if err := bus.RegisterTopic(TopicUserLoginFailed, "Event emitted when a login attempt fails", userLoginFailedSchema); err != nil {
		return err
	}

	return nil
}
