package steps

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher"

	"github.com/mattermost/mattermost-server/v5/model"
)

type simpleStep struct {
	Title                string
	Message              string
	PropertyName         string
	TrueButtonMessage    string
	FalseButtonMessage   string
	TrueResponseMessage  string
	FalseResponseMessage string
	TrueSkip             int
	FalseSkip            int
}

func NewSimpleStep(
	title,
	message,
	propertyName,
	trueButtonMessage,
	falseButtonMessage,
	trueResponseMessage,
	falseResponseMessage string,
	trueSkip,
	falseSkip int,
) Step {
	return &simpleStep{
		Title:                title,
		Message:              message,
		PropertyName:         propertyName,
		TrueButtonMessage:    trueButtonMessage,
		FalseButtonMessage:   falseButtonMessage,
		TrueResponseMessage:  trueResponseMessage,
		FalseResponseMessage: falseResponseMessage,
		TrueSkip:             trueSkip,
		FalseSkip:            falseSkip,
	}
}

func (s *simpleStep) PostSlackAttachment(flowHandler string, i int) *model.SlackAttachment {
	trueValue, _ := json.Marshal(true)
	falseValue, _ := json.Marshal(false)
	stepValue, _ := json.Marshal(i)

	actionTrue := model.PostAction{
		Name: s.TrueButtonMessage,
		Integration: &model.PostActionIntegration{
			URL: flowHandler,
			Context: map[string]interface{}{
				ContextPropertyKey:    s.PropertyName,
				ContextButtonValueKey: string(trueValue),
				ContextStepKey:        string(stepValue),
			},
		},
	}

	actionFalse := model.PostAction{
		Name: s.FalseButtonMessage,
		Integration: &model.PostActionIntegration{
			URL: flowHandler,
			Context: map[string]interface{}{
				ContextPropertyKey:    s.PropertyName,
				ContextButtonValueKey: string(falseValue),
				ContextStepKey:        string(stepValue),
			},
		},
	}

	sa := model.SlackAttachment{
		Title:    s.Title,
		Text:     s.Message,
		Fallback: fmt.Sprintf("%s: %s", s.Title, s.Message),
		Actions:  []*model.PostAction{&actionTrue, &actionFalse},
	}

	return &sa
}

func (s *simpleStep) ResponseSlackAttachment(rawValue interface{}) *model.SlackAttachment {
	value := s.parseValue(rawValue)

	message := s.FalseResponseMessage
	if value {
		message = s.TrueResponseMessage
	}

	sa := model.SlackAttachment{
		Title:    s.Title,
		Text:     message,
		Fallback: fmt.Sprintf("%s: %s", s.Title, message),
		Actions:  []*model.PostAction{},
	}

	return &sa
}

func (s *simpleStep) GetPropertyName() string {
	return s.PropertyName
}

func (s *simpleStep) ShouldSkip(rawValue interface{}) int {
	value := s.parseValue(rawValue)

	if value {
		return s.TrueSkip
	}

	return s.FalseSkip
}

func (s *simpleStep) IsEmpty() bool {
	return false
}

func (*simpleStep) parseValue(rawValue interface{}) (value bool) {
	err := json.Unmarshal([]byte(rawValue.(string)), &value)
	if err != nil {
		return false
	}

	return value
}

func (*simpleStep) GetFreetextFetcher() freetextfetcher.FreetextFetcher {
	return nil
}
