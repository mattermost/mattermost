// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"context"
	"encoding/json"
	"maps"
)

// TranslationObjectType identifies the type of object being translated
const (
	TranslationObjectTypePost = "post"
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
	TranslationStateReady       TranslationState = "ready"       // Translation completed successfully
	TranslationStateSkipped     TranslationState = "skipped"     // Translation not needed (srcLang == dstLang or only masked content)
	TranslationStateProcessing  TranslationState = "processing"  // Translation in progress
	TranslationStateUnavailable TranslationState = "unavailable" // Translation failed or not configured
)

// Translation represents a single translation result
type Translation struct {
	ObjectID   string           `json:"object_id"`
	ObjectType string           `json:"object_type"`
	ChannelID  string           `json:"channel_id,omitempty"` // Channel ID for efficient queries
	Lang       string           `json:"lang"`
	Provider   string           `json:"provider"`
	Type       TranslationType  `json:"type"`
	Text       string           `json:"text"`
	ObjectJSON json.RawMessage  `json:"object_json,omitempty"`
	Confidence *float64         `json:"confidence,omitempty"`
	State      TranslationState `json:"state"`
	Meta       map[string]any   `json:"meta,omitempty"`
	NormHash   string           `json:"norm_hash,omitempty"`
	UpdateAt   int64            `json:"update_at,omitempty"` // Timestamp in milliseconds
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
		ChannelID:  t.ChannelID,
		Lang:       t.Lang,
		Provider:   t.Provider,
		Type:       t.Type,
		Text:       t.Text,
		ObjectJSON: objectJSON,
		Confidence: confidence,
		State:      t.State,
		Meta:       meta,
		NormHash:   t.NormHash,
		UpdateAt:   t.UpdateAt,
	}
}

// ToPostTranslation converts a Translation to a PostTranslation.
// This is the canonical conversion function used throughout the codebase
// to ensure consistent struct creation when populating post metadata.
func (t *Translation) ToPostTranslation() *PostTranslation {
	if t == nil {
		return nil
	}

	// Extract source language from meta if available
	var sourceLang string
	if srcLang, ok := t.Meta["src_lang"].(string); ok {
		sourceLang = srcLang
	}

	pt := &PostTranslation{
		State:      string(t.State),
		SourceLang: sourceLang,
	}

	if t.Type == TranslationTypeObject {
		pt.Object = t.ObjectJSON
	} else {
		pt.Text = t.Text
	}

	return pt
}

func (t *Translation) IsValid() *AppError {
	if t == nil {
		return NewAppError("Translation.IsValid", "model.translation.is_valid.nil.app_error", nil, "", 400)
	}
	if t.ObjectID == "" || !IsValidId(t.ObjectID) {
		return NewAppError("Translation.IsValid", "model.translation.is_valid.object_id.app_error", nil, "invalid object id", 400)
	}
	if t.ObjectType == "" {
		return NewAppError("Translation.IsValid", "model.translation.is_valid.object_type.app_error", nil, "object type is empty", 400)
	}
	if t.Lang == "" {
		return NewAppError("Translation.IsValid", "model.translation.is_valid.lang.app_error", nil, "lang is empty", 400)
	}

	// Text and provider are required only for ready state
	if t.State == TranslationStateReady {
		if t.Provider == "" {
			return NewAppError("Translation.IsValid", "model.translation.is_valid.provider.app_error", nil, "provider is empty for ready state", 400)
		}
		if t.Type == "" {
			return NewAppError("Translation.IsValid", "model.translation.is_valid.type.app_error", nil, "type is empty", 400)
		}
		if t.Type != TranslationTypeString && t.Type != TranslationTypeObject {
			return NewAppError("Translation.IsValid", "model.translation.is_valid.type_invalid.app_error", nil, "invalid type", 400)
		}
		if t.Type == TranslationTypeString && t.Text == "" {
			return NewAppError("Translation.IsValid", "model.translation.is_valid.text.app_error", nil, "text is empty", 400)
		}
		if t.Type == TranslationTypeObject && len(t.ObjectJSON) == 0 {
			return NewAppError("Translation.IsValid", "model.translation.is_valid.object_json.app_error", nil, "object json is empty", 400)
		}
	}

	// Provider required for unavailable state (to indicate why it failed)
	if t.State == TranslationStateUnavailable && t.Provider == "" {
		return NewAppError("Translation.IsValid", "model.translation.is_valid.provider.app_error", nil, "provider is empty for unavailable state", 400)
	}

	return nil
}

// Context keys for auto-translation path tracking
type AutoTranslationContextKey string

const (
	ContextKeyAutoTranslationPath AutoTranslationContextKey = "autotranslation_path"
)

// ErrAutoTranslationNotAvailable is returned when the auto-translation feature is not available
// due to missing license, disabled feature flag, or disabled configuration.
// Callers can check for this specific error to handle unavailability gracefully.
type ErrAutoTranslationNotAvailable struct {
	reason string
}

func (e *ErrAutoTranslationNotAvailable) Error() string {
	if e.reason != "" {
		return "auto-translation feature not available: " + e.reason
	}
	return "auto-translation feature not available"
}

// NewErrAutoTranslationNotAvailable creates a new ErrAutoTranslationNotAvailable error
func NewErrAutoTranslationNotAvailable(reason string) *ErrAutoTranslationNotAvailable {
	return &ErrAutoTranslationNotAvailable{reason: reason}
}

// AutoTranslationPath represents the code path that initiated a translation.
// This enables observability (metrics) and path-specific behavior (timeouts).
type AutoTranslationPath string

// Auto-translation path values for metrics and behavior control.
// Paths follow pattern: <operation> for object operations, <channel> for delivery paths.
const (
	AutoTranslationPathCreate            AutoTranslationPath = "create"             // Object creation (e.g., create post)
	AutoTranslationPathEdit              AutoTranslationPath = "edit"               // Object edit (e.g., edit post)
	AutoTranslationPathFetch             AutoTranslationPath = "fetch"              // API fetch (on-demand for older objects)
	AutoTranslationPathWebSocket         AutoTranslationPath = "websocket"          // WebSocket event augmentation
	AutoTranslationPathPushNotification  AutoTranslationPath = "push_notification"  // Push notification
	AutoTranslationPathEmailNotification AutoTranslationPath = "email_notification" // Email notification
	AutoTranslationPathUnknown           AutoTranslationPath = "unknown"            // Fallback
)

// WithAutoTranslationPath adds translation path to context for metrics and behavior control.
// This enables both observability (metrics tracking) and path-specific behavior
// (e.g., different timeouts for websocket vs notification paths).
//
// Usage in server (API layer):
//
//	ctx = model.WithAutoTranslationPath(ctx, model.AutoTranslationPathCreate)
//	translation, err := a.AutoTranslation().Translate(ctx, ...)
func WithAutoTranslationPath(ctx context.Context, path AutoTranslationPath) context.Context {
	return context.WithValue(ctx, ContextKeyAutoTranslationPath, path)
}

// GetAutoTranslationPath extracts translation path from context.
// Returns AutoTranslationPathUnknown if no path is set.
//
// Usage in enterprise:
//
//	path := model.GetAutoTranslationPath(ctx)
func GetAutoTranslationPath(ctx context.Context) AutoTranslationPath {
	if path, ok := ctx.Value(ContextKeyAutoTranslationPath).(AutoTranslationPath); ok {
		return path
	}
	return AutoTranslationPathUnknown
}
