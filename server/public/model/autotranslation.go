// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"maps"
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
	NormHash   string           `json:"norm_hash,omitempty"`
}

func (t *Translation) Clone() *Translation {
	if t == nil {
		return nil
	}
	var confidence *float64
	if t.Confidence != nil {
		val := *t.Confidence
		confidence = &val
	}

	var meta map[string]any
	if t.Meta != nil {
		meta = make(map[string]any, len(t.Meta))
		maps.Copy(meta, t.Meta)
	}
	var objectJSON json.RawMessage
	if t.ObjectJSON != nil {
		objectJSON = make([]byte, len(t.ObjectJSON))
		copy(objectJSON, t.ObjectJSON)
	}
	return &Translation{
		ObjectID:   t.ObjectID,
		ObjectType: t.ObjectType,
		Lang:       t.Lang,
		Provider:   t.Provider,
		Type:       t.Type,
		Text:       t.Text,
		ObjectJSON: objectJSON,
		Confidence: confidence,
		State:      t.State,
		Meta:       meta,
		NormHash:   t.NormHash,
	}
}

func (t *Translation) IsValid() bool {
	if t == nil {
		return false
	}
	if t.Provider == "" || t.ObjectID == "" || !IsValidId(t.ObjectID) || t.ObjectType == "" || t.Lang == "" || t.Type == "" || t.State != TranslationStateReady {
		return false
	}
	if t.Type != TranslationTypeString && t.Type != TranslationTypeObject {
		return false
	}
	if t.Type == TranslationTypeString && t.Text == "" {
		return false
	}
	if t.Type == TranslationTypeObject && len(t.ObjectJSON) == 0 {
		return false
	}
	if t.NormHash == "" {
		return false
	}
	return true
}
