// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

type TaskAction struct {
	Trigger Trigger  `json:"trigger"`
	Actions []Action `json:"actions"`
}

type TaskActionType string
type TaskTriggerType string

type Trigger struct {
	Type TaskTriggerType `json:"type"`
	// Payload is the json payload that stores trigger specific settings or config.
	// This should be unmarshalled into a concrete type during usage
	Payload string `json:"payload"`
}

type Action struct {
	Type TaskActionType `json:"type"`
	// Payload is the json payload that stores action specific settings or config.
	// This should be unmarshalled into a concrete type during usage
	Payload string `json:"payload"`
}

// Known Types
const (
	KeywordsByUsersTriggerType TaskTriggerType = "keywords_by_users"

	MarkItemAsDoneActionType TaskActionType = "mark_item_as_done"
)

var (
	ValidTaskActionTypes = []TaskActionType{
		MarkItemAsDoneActionType,
	}
)

// Triggers
type KeywordsByUsersTrigger struct {
	typ     TaskTriggerType
	Payload KeywordsByUsersTriggerPayload
}

type KeywordsByUsersTriggerPayload struct {
	Keywords []string `json:"keywords" mapstructure:"keywords"`
	UserIDs  []string `json:"user_ids" mapstructure:"user_ids"`
}

func NewKeywordsByUsersTrigger(trigger Trigger) (*KeywordsByUsersTrigger, error) {
	if trigger.Type != KeywordsByUsersTriggerType {
		return nil, errors.Errorf("Unexpected trigger type: %s, expected: %s", trigger.Type, KeywordsByUsersTriggerType)
	}
	var t KeywordsByUsersTrigger
	t.typ = KeywordsByUsersTriggerType

	if err := json.Unmarshal([]byte(trigger.Payload), &t.Payload); err != nil {
		return nil, errors.New("unable to decode payload from trigger")
	}
	return &t, nil
}

func (t *KeywordsByUsersTrigger) IsValid() error {
	return nil
}

func (t *KeywordsByUsersTrigger) IsTriggered(post *model.Post) bool {
	foundUser := false
	if len(t.Payload.UserIDs) > 0 {
		for _, userID := range t.Payload.UserIDs {
			if post.UserId == userID {
				foundUser = true
				break
			}
		}
	} else {
		foundUser = true
	}
	if foundUser {
		for _, keyword := range t.Payload.Keywords {
			if strings.Contains(post.Message, keyword) {
				logrus.WithField("keyword", keyword)
				return true
			}
		}
	}
	return false
}

// Actions
type MarkItemAsDoneAction struct {
	typ     TaskActionType
	Payload MarkItemAsDoneActionPayload
}

type MarkItemAsDoneActionPayload struct {
	Enabled bool `json:"enabled"`
}

func NewMarkItemAsDoneAction(action Action) (*MarkItemAsDoneAction, error) {
	if action.Type != MarkItemAsDoneActionType {
		return nil, errors.Errorf("Unexpected trigger type: %s, expected: %s", action.Type, MarkItemAsDoneActionType)
	}
	var a MarkItemAsDoneAction
	a.typ = MarkItemAsDoneActionType

	if err := json.Unmarshal([]byte(action.Payload), &a.Payload); err != nil {
		return nil, errors.New("unable to decode payload from trigger")
	}
	return &a, nil
}

func (a *MarkItemAsDoneAction) IsValid() error {
	return nil
}

// Validators
func ValidateTrigger(t Trigger) error {
	switch t.Type {
	case KeywordsByUsersTriggerType:
		trigger, err := NewKeywordsByUsersTrigger(t)
		if err != nil {
			return err
		}
		return trigger.IsValid()
	default:
		return errors.Errorf("Unknown task trigger type: %s", t.Type)
	}
}

func ValidateAction(a Action) error {
	switch a.Type {
	case MarkItemAsDoneActionType:
		action, err := NewMarkItemAsDoneAction(a)
		if err != nil {
			return err
		}
		return action.IsValid()
	default:
		return errors.Errorf("Unknown task action type: %s", a.Type)
	}
}
