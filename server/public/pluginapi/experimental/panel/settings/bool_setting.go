package settings

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

type boolSetting struct {
	baseSetting
	store SettingStore
}

// NewBoolSetting creates a new setting input for boolean values
func NewBoolSetting(id, title, description, dependsOn string, store SettingStore) Setting {
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
	if value == TrueString {
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

	stringValue := FalseString
	if boolValue {
		stringValue = TrueString
	}

	return stringValue, nil
}

func (s *boolSetting) GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error) {
	title := fmt.Sprintf("Setting: %s", s.title)
	currentValueMessage := DisabledString

	actions := []*model.PostAction{}
	if !disabled {
		currentValue, err := s.Get(userID)
		if err != nil {
			return nil, err
		}

		currentTextValue := "No"
		if currentValue == TrueString {
			currentTextValue = "Yes"
		}
		currentValueMessage = fmt.Sprintf("Current value: %s", currentTextValue)

		actionTrue := model.PostAction{
			Name: "Yes",
			Integration: &model.PostActionIntegration{
				URL: settingHandler,
				Context: map[string]interface{}{
					ContextIDKey:          s.id,
					ContextButtonValueKey: TrueString,
				},
			},
		}

		actionFalse := model.PostAction{
			Name: "No",
			Integration: &model.PostActionIntegration{
				URL: settingHandler,
				Context: map[string]interface{}{
					ContextIDKey:          s.id,
					ContextButtonValueKey: FalseString,
				},
			},
		}
		actions = []*model.PostAction{&actionTrue, &actionFalse}
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

func (s *boolSetting) IsDisabled(foreignValue interface{}) bool {
	return foreignValue == FalseString
}
