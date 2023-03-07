// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package worktemplates

import (
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/i18n"
)

type WorkTemplateCategory struct {
	ID   string `yaml:"id"`
	Name string `yaml:"name"`
}

type WorkTemplate struct {
	ID           string       `yaml:"id"`
	Category     string       `yaml:"category"`
	UseCase      string       `yaml:"useCase"`
	Illustration string       `yaml:"illustration"`
	Visibility   string       `yaml:"visibility"`
	FeatureFlag  *FeatureFlag `yaml:"featureFlag,omitempty"`
	Description  Description  `yaml:"description"`
	Content      []Content    `yaml:"content"`
}

func (wt WorkTemplate) ToModelWorkTemplate(t i18n.TranslateFunc) *model.WorkTemplate {
	mwt := &model.WorkTemplate{
		ID:           wt.ID,
		Category:     wt.Category,
		UseCase:      wt.UseCase,
		Illustration: wt.Illustration,
		Visibility:   wt.Visibility,
	}

	if wt.FeatureFlag != nil {
		mwt.FeatureFlag = &model.WorkTemplateFeatureFlag{
			Name:  wt.FeatureFlag.Name,
			Value: wt.FeatureFlag.Value,
		}
	}

	if wt.Description.Channel != nil {
		mwt.Description.Channel = &model.DescriptionContent{
			Message:      wt.Description.Channel.Translate(t),
			Illustration: wt.Description.Channel.Illustration,
		}
	}

	if wt.Description.Board != nil {
		mwt.Description.Board = &model.DescriptionContent{
			Message:      wt.Description.Board.Translate(t),
			Illustration: wt.Description.Board.Illustration,
		}
	}

	if wt.Description.Playbook != nil {
		mwt.Description.Playbook = &model.DescriptionContent{
			Message:      wt.Description.Playbook.Translate(t),
			Illustration: wt.Description.Playbook.Illustration,
		}
	}

	if wt.Description.Integration != nil {
		mwt.Description.Integration = &model.DescriptionContent{
			Message:      wt.Description.Integration.Translate(t),
			Illustration: wt.Description.Integration.Illustration,
		}
	}

	for _, content := range wt.Content {
		if content.Channel != nil {
			mwt.Content = append(mwt.Content, model.WorkTemplateContent{
				Channel: &model.WorkTemplateChannel{
					ID:           content.Channel.ID,
					Name:         content.Channel.Name,
					Purpose:      content.Channel.Purpose,
					Playbook:     content.Channel.Playbook,
					Illustration: content.Channel.Illustration,
				},
			})
		}
		if content.Board != nil {
			mwt.Content = append(mwt.Content, model.WorkTemplateContent{
				Board: &model.WorkTemplateBoard{
					ID:           content.Board.ID,
					Name:         content.Board.Name,
					Template:     content.Board.Template,
					Channel:      content.Board.Channel,
					Illustration: content.Board.Illustration,
				},
			})
		}
		if content.Playbook != nil {
			mwt.Content = append(mwt.Content, model.WorkTemplateContent{
				Playbook: &model.WorkTemplatePlaybook{
					ID:           content.Playbook.ID,
					Name:         content.Playbook.Name,
					Template:     content.Playbook.Template,
					Illustration: content.Playbook.Illustration,
				},
			})
		}
		if content.Integration != nil {
			mwt.Content = append(mwt.Content, model.WorkTemplateContent{
				Integration: &model.WorkTemplateIntegration{
					ID: content.Integration.ID,
				},
			})
		}
	}

	return mwt
}

func (wt WorkTemplate) Validate(categoryIds map[string]struct{}) error {
	if wt.ID == "" {
		return errors.New("id is required")
	}
	if wt.Category == "" {
		return errors.New("category is required")
	}
	if _, ok := categoryIds[wt.Category]; !ok {
		return fmt.Errorf("category %s does not exist", wt.Category)
	}
	if wt.UseCase == "" {
		return errors.New("useCase is required")
	}
	if wt.Illustration == "" {
		return errors.New("illustration is required")
	}
	if wt.Visibility == "" {
		return errors.New("visibility is required")
	}
	hasChannel := false
	hasBoard := false
	hasPlaybook := false
	hasIntegration := false
	foundChannels := map[string]struct{}{}
	foundPlaybooks := map[string]struct{}{}
	foundBoards := map[string]struct{}{}
	foundIntegrations := map[string]struct{}{}
	mustHaveChannels := []string{}
	mustHavePlaybooks := []string{}

	currentIdx := 0
	for _, content := range wt.Content {
		if content.Channel != nil {
			hasChannel = true
			if cErr := content.Channel.Validate(); cErr != nil {
				return wrapContentError(cErr, currentIdx)
			}
			if _, ok := foundChannels[content.Channel.ID]; ok {
				return wrapContentError(fmt.Errorf("duplicate channel %s found", content.Channel.ID), currentIdx)
			}
			foundChannels[content.Channel.ID] = struct{}{}

			if content.Channel.Playbook != "" {
				mustHavePlaybooks = append(mustHavePlaybooks, content.Channel.Playbook)
			}
		}

		if content.Board != nil {
			hasBoard = true
			if cErr := content.Board.Validate(); cErr != nil {
				return wrapContentError(cErr, currentIdx)
			}
			if _, ok := foundBoards[content.Board.ID]; ok {
				return wrapContentError(fmt.Errorf("duplicate board %s found", content.Board.ID), currentIdx)
			}
			foundBoards[content.Board.ID] = struct{}{}

			if content.Board.Channel != "" {
				mustHaveChannels = append(mustHaveChannels, content.Board.Channel)
			}
		}
		if content.Playbook != nil {
			hasPlaybook = true
			if cErr := content.Playbook.Validate(); cErr != nil {
				return wrapContentError(cErr, currentIdx)
			}
			if _, ok := foundPlaybooks[content.Playbook.ID]; ok {
				return wrapContentError(fmt.Errorf("duplicate playbook %s found", content.Playbook.ID), currentIdx)
			}
			foundPlaybooks[content.Playbook.ID] = struct{}{}
		}
		if content.Integration != nil {
			hasIntegration = true
			if cErr := content.Integration.Validate(); cErr != nil {
				return wrapContentError(cErr, currentIdx)
			}
			if _, ok := foundIntegrations[content.Integration.ID]; ok {
				return wrapContentError(fmt.Errorf("duplicate integration %s found", content.Integration.ID), currentIdx)
			}
			foundIntegrations[content.Integration.ID] = struct{}{}
		}
	}

	if hasChannel && wt.Description.Channel == nil {
		return errors.New("description.channel is required")
	}
	if hasBoard && wt.Description.Board == nil {
		return errors.New("description.board is required")
	}
	if hasPlaybook && wt.Description.Playbook == nil {
		return errors.New("description.playbook is required")
	}
	if hasIntegration && wt.Description.Integration == nil {
		return errors.New("description.integration is required")
	}

	for _, channel := range mustHaveChannels {
		if _, ok := foundChannels[channel]; !ok {
			return fmt.Errorf("channel %s is required", channel)
		}
	}

	for _, playbook := range mustHavePlaybooks {
		if _, ok := foundPlaybooks[playbook]; !ok {
			return fmt.Errorf("playbook %s is required", playbook)
		}
	}

	return nil
}

type FeatureFlag struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type TranslatableString struct {
	ID             string `yaml:"id"`
	DefaultMessage string `yaml:"defaultMessage"`
	Illustration   string `yaml:"illustration"`
}

func (ts TranslatableString) Translate(t i18n.TranslateFunc) string {
	if ts.ID != "" {
		msg := t(ts.ID)
		if msg != ts.ID && msg != "" {
			return msg
		}
	}

	return ts.DefaultMessage
}

type Description struct {
	Channel     *TranslatableString `yaml:"channel"`
	Board       *TranslatableString `yaml:"board"`
	Playbook    *TranslatableString `yaml:"playbook"`
	Integration *TranslatableString `yaml:"integration"`
}

type Channel struct {
	ID           string `yaml:"id"`
	Name         string `yaml:"name"`
	Purpose      string `yaml:"purpose"`
	Playbook     string `yaml:"playbook"`
	Illustration string `yaml:"illustration"`
}

func (c *Channel) Validate() error {
	if c.ID == "" {
		return errors.New("id is required")
	}
	if c.Name == "" {
		return errors.New("name is required")
	}

	return nil
}

type Board struct {
	ID           string `yaml:"id"`
	Template     string `yaml:"template"`
	Name         string `yaml:"name"`
	Channel      string `yaml:"channel"`
	Illustration string `yaml:"illustration"`
}

func (b Board) Validate() error {
	if b.ID == "" {
		return errors.New("id is required")
	}
	if b.Template == "" {
		return errors.New("template is required")
	}
	if b.Name == "" {
		return errors.New("name is required")
	}

	return nil
}

type Playbook struct {
	Template     string `yaml:"template"`
	Name         string `yaml:"name"`
	ID           string `yaml:"id"`
	Illustration string `yaml:"illustration"`
}

func (p *Playbook) Validate() error {
	if p.ID == "" {
		return errors.New("id is required")
	}
	if p.Template == "" {
		return errors.New("template is required")
	}
	if p.Name == "" {
		return errors.New("name is required")
	}

	return nil
}

type Integration struct {
	ID string `yaml:"id"`
}

func (i *Integration) Validate() error {
	if i.ID == "" {
		return errors.New("id is required")
	}

	return nil
}

type Content struct {
	Channel     *Channel     `yaml:"channel,omitempty"`
	Board       *Board       `yaml:"board,omitempty"`
	Playbook    *Playbook    `yaml:"playbook,omitempty"`
	Integration *Integration `yaml:"integration,omitempty"`
}

func wrapContentError(err error, index int) error {
	return errors.Wrapf(err, "content #%d validation failed", index)
}
