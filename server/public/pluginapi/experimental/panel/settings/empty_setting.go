package settings

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

type emptySetting struct {
	baseSetting
}

// NewEmptySetting creates a new panel value with no setting attached
func NewEmptySetting(id, title, description string) Setting {
	return &emptySetting{
		baseSetting: baseSetting{
			id:          id,
			title:       title,
			description: description,
		},
	}
}

func (s *emptySetting) GetMessageAttachments(userID, settingHandler string, disabled bool) (*model.MessageAttachment, error) {
	title := fmt.Sprintf("Setting: %s", s.title)
	sa := model.MessageAttachment{
		Title:    title,
		Text:     s.description,
		Fallback: fmt.Sprintf("%s: %s", title, s.description),
	}

	return &sa, nil
}

func (s *emptySetting) Get(userID string) (any, error) {
	return nil, nil
}

func (s *emptySetting) Set(userID string, value any) error {
	return nil
}
