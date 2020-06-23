package settings

import (
	"github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher"

	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	ContextIDKey          = "setting_id"
	ContextButtonValueKey = "button_value"
	ContextOptionValueKey = "selected_option"

	DisabledString = "Disabled"
	TrueString     = "true"
	FalseString    = "false"
)

type Setting interface {
	Set(userID string, value interface{}) error
	Get(userID string) (interface{}, error)
	GetID() string
	GetDependency() string
	IsDisabled(foreignValue interface{}) bool
	GetTitle() string
	GetDescription() string
	GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error)
	GetFreetextFetcher() freetextfetcher.FreetextFetcher
}
