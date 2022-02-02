package steps

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
)

type Color string

const (
	ColorDefault Color = "default"
	ColorPrimary Color = "primary"
	ColorSuccess Color = "success"
	ColorGood    Color = "good"
	ColorWarning Color = "warning"
	ColorDanger  Color = "danger"
)

type Button struct {
	Name     string
	Disabled bool
	Style    Color
	OnClick  func(userID string) int

	Dialog *Dialog
}

type CustomStepBuilder struct {
	step customStep
}

// NewCustomStepBuilder create a new builder for a custom step.
//
// name must be a unique identifier for a step within the plugin.
func NewCustomStepBuilder(name, title, message string) *CustomStepBuilder {
	return &CustomStepBuilder{
		step: customStep{
			name:    name,
			title:   title,
			message: message,
		},
	}
}

func (b *CustomStepBuilder) WithColor(color Color) *CustomStepBuilder {
	b.step.color = color

	return b
}

func (b *CustomStepBuilder) WithPretext(text string) *CustomStepBuilder {
	b.step.pretext = text

	return b
}

func (b *CustomStepBuilder) WithButton(button Button) *CustomStepBuilder {
	b.step.buttons = append(b.step.buttons, button)

	return b
}

func (b *CustomStepBuilder) WithImage(path string) *CustomStepBuilder {
	b.step.imagePath = strings.TrimPrefix(path, "/")

	return b
}

func (b *CustomStepBuilder) IsNotEmpty() *CustomStepBuilder {
	b.step.isNotEmpty = true

	return b
}

func (b *CustomStepBuilder) Build() Step {
	return &b.step
}

type customStep struct {
	name    string
	title   string
	message string

	color     Color
	pretext   string
	imagePath string
	buttons   []Button

	isNotEmpty bool
}

func (s *customStep) Attachment(pluginURL string) Attachment {
	a := Attachment{
		SlackAttachment: s.getAttachment(pluginURL),
		Actions:         s.getActions(pluginURL),
	}

	return a
}

func (s *customStep) getAttachment(pluginURL string) *model.SlackAttachment {
	attachment := &model.SlackAttachment{
		Color:    string(s.color),
		Pretext:  s.pretext,
		Title:    s.title,
		Text:     s.message,
		Fallback: fmt.Sprintf("%s: %s", s.title, s.message),
	}

	if s.imagePath != "" {
		attachment.ImageURL = pluginURL + "/" + s.imagePath
	}

	return attachment
}

func (s *customStep) getActions(pluginURL string) []Action {
	if s.buttons == nil {
		return nil
	}

	var actions []Action
	for i, b := range s.buttons {
		onClick := b.OnClick
		j := i

		dialog := b.Dialog

		action := Action{
			PostAction: model.PostAction{
				Type:     model.PostActionTypeButton,
				Name:     b.Name,
				Disabled: b.Disabled,
				Style:    string(b.Style),
			},
			OnClick: func(userID string) (int, Attachment) {
				skip := 0
				if onClick != nil {
					skip = onClick(userID)
				}

				var newActions []Action
				if skip == -1 {
					// Keep full list
					newActions = s.getActions(pluginURL)
				} else {
					// Only list the selected one
					action := s.getActions(pluginURL)[j]
					action.Disabled = true

					newActions = []Action{action}
				}

				attachment := Attachment{
					SlackAttachment: s.getAttachment(pluginURL),
					Actions:         newActions,
				}

				return skip, attachment
			},
		}

		if dialog != nil {
			action.Dialog = &Dialog{
				Dialog: dialog.Dialog,

				OnDialogSubmit: func(userID string, submission map[string]interface{}) (int, *Attachment, string, map[string]string) {
					skip, _, resposeError, resposeErrors := dialog.OnDialogSubmit(userID, submission)

					var newActions []Action
					if skip == -1 || resposeError != "" || len(resposeErrors) != 0 {
						// Keep full list
						newActions = s.getActions(pluginURL)
					} else {
						// Only list the selected one
						newAction := s.getActions(pluginURL)[j]
						newAction.Disabled = true

						newActions = []Action{newAction}
					}

					attachment := &Attachment{
						SlackAttachment: s.getAttachment(pluginURL),
						Actions:         newActions,
					}

					return skip, attachment, resposeError, resposeErrors
				},
			}

			if dialog.OnCancel != nil {
				action.Dialog.Dialog.NotifyOnCancel = true
				action.Dialog.OnCancel = dialog.OnCancel
			} else {
				action.Dialog.Dialog.NotifyOnCancel = false
			}
		}

		actions = append(actions, action)
	}

	return actions
}

func (s *customStep) Name() string {
	return s.name
}

func (s *customStep) IsEmpty() bool {
	if s.isNotEmpty {
		return false
	}

	return len(s.buttons) == 0
}
