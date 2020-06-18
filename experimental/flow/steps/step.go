package steps

import (
	"github.com/mattermost/mattermost-plugin-api/experimental/freetext_fetcher"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	ContextPropertyKey    = "property"
	ContextButtonValueKey = "button_value"
	ContextOptionValueKey = "selected_option"
	ContextStepKey        = "step"
)

type Step interface {
	PostSlackAttachment(flowHandler string, i int) *model.SlackAttachment
	ResponseSlackAttachment(value interface{}) *model.SlackAttachment
	GetPropertyName() string
	ShouldSkip(value interface{}) int
	IsEmpty() bool
	GetFreetextFetcher() freetext_fetcher.FreetextFetcher
}
