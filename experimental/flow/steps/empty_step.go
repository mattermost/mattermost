package steps

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher"

	"github.com/mattermost/mattermost-server/v5/model"
)

type emptyStep struct {
	Title   string
	Message string
}

func NewEmptyStep(title, message string) Step {
	return &emptyStep{
		Title:   title,
		Message: message,
	}
}

func (s *emptyStep) PostSlackAttachment(flowHandler string, i int) *model.SlackAttachment {
	sa := model.SlackAttachment{
		Title:    s.Title,
		Text:     s.Message,
		Fallback: fmt.Sprintf("%s: %s", s.Title, s.Message),
	}

	return &sa
}

func (s *emptyStep) ResponseSlackAttachment(value interface{}) *model.SlackAttachment {
	return nil
}

func (s *emptyStep) GetPropertyName() string {
	return ""
}

func (s *emptyStep) ShouldSkip(value interface{}) int {
	return 0
}

func (s *emptyStep) IsEmpty() bool {
	return true
}

func (*emptyStep) GetFreetextFetcher() freetextfetcher.FreetextFetcher {
	return nil
}
