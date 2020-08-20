package steps

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

type freetextStep struct {
	Title           string
	Message         string
	PropertyName    string
	FreetextFetcher freetextfetcher.FreetextFetcher
}

func NewFreetextStep(
	title,
	message,
	propertyName,
	baseURL string,
	store freetextfetcher.FreetextStore,
	validate func(string) string,
	r *mux.Router,
	p poster.Poster,
) Step {
	return &freetextStep{
		Title:        title,
		Message:      message,
		PropertyName: propertyName,
		FreetextFetcher: freetextfetcher.NewFreetextFetcher(
			baseURL,
			store,
			validate,
			nil,
			nil,
			r,
			p,
		),
	}
}

func (s *freetextStep) PostSlackAttachment(flowHandler string, i int) *model.SlackAttachment {
	sa := model.SlackAttachment{
		Title:    s.Title,
		Text:     s.Message,
		Fallback: fmt.Sprintf("%s: %s", s.Title, s.Message),
	}

	return &sa
}

func (s *freetextStep) ResponseSlackAttachment(value interface{}) *model.SlackAttachment {
	// Not used
	return &model.SlackAttachment{}
}

func (s *freetextStep) GetPropertyName() string {
	return s.PropertyName
}

func (s *freetextStep) ShouldSkip(value interface{}) int {
	if value.(string) == "" {
		return -1
	}

	return 0
}

func (s *freetextStep) IsEmpty() bool {
	return false
}

func (s *freetextStep) GetFreetextFetcher() freetextfetcher.FreetextFetcher {
	return s.FreetextFetcher
}
