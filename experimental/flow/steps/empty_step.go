package steps

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/model"
)

var _ Step = (*EmptyStep)(nil)

type EmptyStep struct {
	name     string
	title    string
	message  string
	OnRender func(userID string)
}

func NewEmptyStep(name, title, message string) *EmptyStep {
	return &EmptyStep{
		name:    name,
		title:   title,
		message: message,
	}
}

func (s *EmptyStep) Attachment(pluginURL string) Attachment {
	sa := Attachment{
		SlackAttachment: &model.SlackAttachment{
			Title:    s.title,
			Text:     s.message,
			Fallback: fmt.Sprintf("%s: %s", s.title, s.message),
		},
	}

	return sa
}

func (s *EmptyStep) Name() string {
	return s.name
}

func (s *EmptyStep) IsEmpty() bool {
	return true
}
