package settings

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

type freetextSetting struct {
	baseSetting
	modifyMessage string
	pluginURL     string
	store         SettingStore
	ftf           freetextfetcher.FreetextFetcher
}

// FreetextInfo defines the information needed in the payload for freetext settings
type FreetextInfo struct {
	SettingID string
	UserID    string
}

// NewFreetextSetting creates a new setting input to add any text
func NewFreetextSetting(
	id,
	title,
	description,
	modifyMessage,
	dependsOn string,
	store SettingStore,
	baseURL,
	pluginURL string,
	ftfStore freetextfetcher.FreetextStore,
	validate func(string) string,
	r *mux.Router,
	p poster.Poster,
) Setting {
	setting := &freetextSetting{
		baseSetting: baseSetting{
			title:       title,
			description: description,
			id:          id,
			dependsOn:   dependsOn,
		},
		modifyMessage: modifyMessage,
		store:         store,
		pluginURL:     pluginURL,
	}
	setting.ftf = freetextfetcher.NewFreetextFetcher(baseURL, ftfStore, validate, nil, nil, r, p)
	return setting
}

func (s *freetextSetting) Set(userID string, value interface{}) error {
	err := s.store.SetSetting(userID, s.id, value)
	if err != nil {
		return err
	}

	return nil
}

func (s *freetextSetting) Get(userID string) (interface{}, error) {
	value, err := s.store.GetSetting(userID, s.id)
	if err != nil {
		return "", err
	}
	stringValue, ok := value.(string)
	if !ok {
		return "", errors.New("current value is not a string")
	}

	return stringValue, nil
}

func (s *freetextSetting) GetSlackAttachments(userID, settingHandler string, disabled bool) (*model.SlackAttachment, error) {
	title := fmt.Sprintf("Setting: %s", s.title)
	currentValueMessage := DisabledString

	actions := []*model.PostAction{}
	if !disabled {
		currentValue, err := s.Get(userID)
		if err != nil {
			return nil, err
		}

		currentValueMessage = fmt.Sprintf("Current value: %s", currentValue)

		payload, err := json.Marshal(FreetextInfo{
			UserID:    userID,
			SettingID: s.GetID(),
		})
		if err != nil {
			return nil, err
		}

		actionEdit := model.PostAction{
			Name: "Edit",
			Integration: &model.PostActionIntegration{
				URL: s.pluginURL + s.ftf.URL() + "/new",
				Context: map[string]interface{}{
					freetextfetcher.ContextNewMessage: s.modifyMessage,
					freetextfetcher.ContextNewPayload: string(payload),
				},
			},
		}
		actions = []*model.PostAction{&actionEdit}
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

func (s *freetextSetting) IsDisabled(foreignValue interface{}) bool {
	return foreignValue == FalseString
}

func (s *freetextSetting) GetFreetextFetcher() freetextfetcher.FreetextFetcher {
	return s.ftf
}
