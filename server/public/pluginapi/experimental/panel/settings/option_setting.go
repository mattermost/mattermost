package settings

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

type optionSetting struct {
	baseSetting
	options []string
	store   SettingStore
}

// NewOptionSetting creates a new setting input to select from a dropdown
func NewOptionSetting(id, title, description, dependsOn string, options []string, store SettingStore) Setting {
	return &optionSetting{
		baseSetting: baseSetting{
			title:       title,
			description: description,
			id:          id,
			dependsOn:   dependsOn,
		},
		options: options,
		store:   store,
	}
}

func (s *optionSetting) Set(userID string, value interface{}) error {
	err := s.store.SetSetting(userID, s.id, value)
	if err != nil {
		return err
	}

	return nil
}

func (s *optionSetting) Get(userID string) (interface{}, error) {
	value, err := s.store.GetSetting(userID, s.id)
	if err != nil {
		return "", err
	}
	valueString, ok := value.(string)
	if !ok {
		return "", errors.New("current value is not a string")
	}

	return valueString, nil
}

func (s *optionSetting) GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error) {
	title := fmt.Sprintf("Setting: %s", s.title)
	currentValueMessage := DisabledString

	actions := []*model.PostAction{}
	if !disabled {
		currentTextValue, err := s.Get(userID)
		if err != nil {
			return nil, err
		}
		currentValueMessage = fmt.Sprintf("Current value: %s", currentTextValue)

		actionOptions := model.PostAction{
			Name: "Select an option:",
			Integration: &model.PostActionIntegration{
				URL: settingHandler + "?" + s.id + "=true",
				Context: map[string]interface{}{
					ContextIDKey: s.id,
				},
			},
			Type:    "select",
			Options: stringsToOptions(s.options),
		}

		actions = []*model.PostAction{&actionOptions}
	}

	text := fmt.Sprintf("%s\n%s", s.description, currentValueMessage)
	sa := model.SlackAttachment{
		Title:    title,
		Text:     text,
		Fallback: fmt.Sprintf("%s: %s", title, text),
		Actions:  actions,
	}
	return &sa, nil
}

func (s *optionSetting) IsDisabled(foreignValue interface{}) bool {
	return foreignValue == FalseString
}
