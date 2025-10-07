// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

// TranslationType indicates the type of translated content
type TranslationType string

const (
	TranslationTypeString TranslationType = "string"
	TranslationTypeObject TranslationType = "object"
)

// TranslationState represents the state of a translation
type TranslationState string

const (
	TranslationStateReady       TranslationState = "ready"
	TranslationStateSkipped     TranslationState = "skipped"
	TranslationStateUnavailable TranslationState = "unavailable"
)

// Translation represents a single translation result
type Translation struct {
	ObjectID   string           `json:"object_id"`
	ObjectType string           `json:"object_type"`
	Lang       string           `json:"lang"`
	Provider   string           `json:"provider"`
	Type       TranslationType  `json:"type"`
	Text       string           `json:"text"`
	ObjectJSON json.RawMessage  `json:"object_json,omitempty"`
	Confidence *float64         `json:"confidence,omitempty"`
	State      TranslationState `json:"state"`
	Meta       map[string]any   `json:"meta,omitempty"`
	NormHash   *string          `json:"norm_hash,omitempty"`
}
