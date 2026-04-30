// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"unicode/utf8"

	"github.com/pkg/errors"
)

const (
	PropertyValueTargetIDMaxRunes   = 255
	PropertyValueTargetTypeMaxRunes = 255

	PropertyValueTargetTypePost    = "post"
	PropertyValueTargetTypeUser    = "user"
	PropertyValueTargetTypeChannel = "channel"
	PropertyValueTargetTypeSystem  = "system"

	// PropertyValueSystemTargetID is the canonical TargetID sentinel for
	// values whose TargetType is "system". System-object values attach to
	// the Mattermost instance itself rather than to a user/channel/post,
	// so there is no 26-char entity ID available; this sentinel stands in.
	PropertyValueSystemTargetID = "system"
)

type PropertyValue struct {
	ID         string          `json:"id"`
	TargetID   string          `json:"target_id"`
	TargetType string          `json:"target_type"`
	GroupID    string          `json:"group_id"`
	FieldID    string          `json:"field_id"`
	Value      json.RawMessage `json:"value"`
	CreateAt   int64           `json:"create_at"`
	UpdateAt   int64           `json:"update_at"`
	DeleteAt   int64           `json:"delete_at"`
	CreatedBy  string          `json:"created_by"`
	UpdatedBy  string          `json:"updated_by"`
}

// isValidPropertyValueTargetID accepts the canonical system sentinel when
// the value targets the system, and a 26-char entity ID otherwise.
func isValidPropertyValueTargetID(targetType, targetID string) bool {
	if targetType == PropertyValueTargetTypeSystem {
		return targetID == PropertyValueSystemTargetID
	}
	return IsValidId(targetID)
}

func (pv *PropertyValue) PreSave() {
	if pv.ID == "" {
		pv.ID = NewId()
	}

	if pv.CreateAt == 0 {
		pv.CreateAt = GetMillis()
	}
	pv.UpdateAt = pv.CreateAt
}

func (pv *PropertyValue) IsValid() error {
	if !IsValidId(pv.ID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "id", "Reason": "invalid id"}, "", http.StatusBadRequest)
	}

	if !isValidPropertyValueTargetID(pv.TargetType, pv.TargetID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "invalid id"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.TargetType == "" {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "value cannot be empty"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(pv.TargetType) > PropertyValueTargetTypeMaxRunes {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "value exceeds maximum length"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(pv.TargetID) > PropertyValueTargetIDMaxRunes {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "value exceeds maximum length"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if !IsValidId(pv.GroupID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "group_id", "Reason": "invalid id"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if !IsValidId(pv.FieldID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "field_id", "Reason": "invalid id"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.CreateAt == 0 {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "create_at", "Reason": "value cannot be zero"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.UpdateAt == 0 {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "update_at", "Reason": "value cannot be zero"}, "id="+pv.ID, http.StatusBadRequest)
	}

	return nil
}

type PropertyValueSearchCursor struct {
	PropertyValueID string
	CreateAt        int64
}

func (p PropertyValueSearchCursor) IsEmpty() bool {
	return p.PropertyValueID == "" && p.CreateAt == 0
}

func (p PropertyValueSearchCursor) IsValid() error {
	if p.IsEmpty() {
		return nil
	}

	if p.CreateAt <= 0 {
		return errors.New("create at cannot be negative or zero")
	}

	if !IsValidId(p.PropertyValueID) {
		return errors.New("property field id is invalid")
	}
	return nil
}

type PropertyValueSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetIDs      []string
	FieldID        string
	SinceUpdateAt  int64 // UpdateAt after which to send the items
	IncludeDeleted bool
	Cursor         PropertyValueSearchCursor
	PerPage        int
	Value          json.RawMessage
}

// PropertyValueSearch captures the parameters provided by a client for
// searching property values
type PropertyValueSearch struct {
	CursorID       string `json:"cursor_id,omitempty"`
	CursorCreateAt int64  `json:"cursor_create_at,omitempty"`
	PerPage        int    `json:"per_page"`
}

// PropertyValuePatchItem represents a single field value update in a
// batch PATCH request for property values.
type PropertyValuePatchItem struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}
