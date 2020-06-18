package settings

import (
	"github.com/mattermost/mattermost-plugin-api/experimental/freetext_fetcher"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	ContextIDKey          = "setting_id"
	ContextButtonValueKey = "button_value"
	ContextOptionValueKey = "selected_option"
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
	GetFreetextFetcher() freetext_fetcher.FreetextFetcher
}
