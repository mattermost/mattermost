package settings

import (
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	// ContextIDKey defines the key used in the context to store the ID
	ContextIDKey = "setting_id"
	// ContextButtonValueKey defines the key used in the context to store a button value
	ContextButtonValueKey = "button_value"
	// ContextOptionValueKey defines the key used in the context to store a selected option value
	ContextOptionValueKey = "selected_option"

	// DisabledString defines the string used to show that a setting is disabled
	DisabledString = "Disabled"
	// TrueString codify the boolean true into a string
	TrueString = "true"
	// FalseString codify the boolean false into a string
	FalseString = "false"
)

// Setting defines the behavior of each element a the panel
type Setting interface {
	Set(userID string, value interface{}) error
	Get(userID string) (interface{}, error)
	GetID() string
	GetDependency() string
	IsDisabled(foreignValue interface{}) bool
	GetTitle() string
	GetDescription() string
	GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error)
}
