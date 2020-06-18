package settings

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
)

type boolSetting struct {
	baseSetting
	store SettingStore
}

func NewBoolSetting(id string, title string, description string, dependsOn string, store SettingStore) Setting {
	return &boolSetting{
		baseSetting: baseSetting{
			title:       title,
			description: description,
			id:          id,
			dependsOn:   dependsOn,
		},
		store: store,
	}
}

func (s *boolSetting) Set(userID string, value interface{}) error {
	boolValue := false
	if value == "true" {
		boolValue = true
	}

	err := s.store.SetSetting(userID, s.id, boolValue)
	if err != nil {
		return err
	}

	return nil
}

func (s *boolSetting) Get(userID string) (interface{}, error) {
	value, err := s.store.GetSetting(userID, s.id)
	if err != nil {
		return "", err
	}
	boolValue, ok := value.(bool)
	if !ok {
		return "", errors.New("current value is not a bool")
	}

	stringValue := "false"
	if boolValue {
		stringValue = "true"
	}

	return stringValue, nil
}

func (s *boolSetting) GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error) {
	title := fmt.Sprintf("Setting: %s", s.title)
	currentValueMessage := "Disabled"

	actions := []*model.PostAction{}
	if !disabled {
		currentValue, err := s.Get(userID)
		if err != nil {
			return nil, err
		}

		currentTextValue := "No"
		if currentValue == "true" {
			currentTextValue = "Yes"
		}
		currentValueMessage = fmt.Sprintf("Current value: %s", currentTextValue)

		actionTrue := model.PostAction{
			Name: "Yes",
			Integration: &model.PostActionIntegration{
				URL: settingHandler,
				Context: map[string]interface{}{
					ContextIDKey:          s.id,
					ContextButtonValueKey: "true",
				},
			},
		}

		actionFalse := model.PostAction{
			Name: "No",
			Integration: &model.PostActionIntegration{
				URL: settingHandler,
				Context: map[string]interface{}{
					ContextIDKey:          s.id,
					ContextButtonValueKey: "false",
				},
			},
		}
		actions = []*model.PostAction{&actionTrue, &actionFalse}

	}

	text := fmt.Sprintf("%s\n%s", s.description, currentValueMessage)
	sa := model.SlackAttachment{
		Title:   title,
		Text:    text,
		Actions: actions,
	}

	return &sa, nil
}

func (s *boolSetting) IsDisabled(foreignValue interface{}) bool {
	return foreignValue == "false"
}
