// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strings"
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

// PropertyValueSearchCursor carries two alternative pagination keys because
// value listings serve two different read patterns:
//
//   - Directory listings (no since filter) page in creation order using
//     CreateAt + PropertyValueID. CreateAt never changes, so the scan is
//     stable across concurrent updates.
//   - Delta sync (SinceUpdateAt > 0) pages in update order using UpdateAt +
//     PropertyValueID, matching the ORDER BY the store applies in that mode.
//
// IsValid requires exactly one of CreateAt or UpdateAt to be positive
// alongside a valid PropertyValueID. An empty cursor is also valid and means
// "start from the beginning".
type PropertyValueSearchCursor struct {
	PropertyValueID string
	CreateAt        int64
	UpdateAt        int64
}

func (p PropertyValueSearchCursor) IsEmpty() bool {
	return p.PropertyValueID == "" && p.CreateAt == 0 && p.UpdateAt == 0
}

func (p PropertyValueSearchCursor) IsValid() error {
	if p.IsEmpty() {
		return nil
	}

	if !IsValidId(p.PropertyValueID) {
		return errors.New("property value id is invalid")
	}

	hasCreate := p.CreateAt > 0
	hasUpdate := p.UpdateAt > 0
	if hasCreate == hasUpdate {
		return errors.New("cursor must have exactly one of create_at or update_at set")
	}
	return nil
}

// PropertyValueSearchOpts captures the filters accepted by SearchPropertyValues.
//
// SinceUpdateAt > 0 switches the endpoint to delta mode: rows are ordered by
// UpdateAt, tombstones are included automatically, and pagination must use
// Cursor.UpdateAt (Cursor.CreateAt is used in the default directory mode).
type PropertyValueSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetIDs      []string
	FieldID        string
	SinceUpdateAt  int64
	IncludeDeleted bool
	Cursor         PropertyValueSearchCursor
	PerPage        int
	Value          json.RawMessage
}

func (o PropertyValueSearchOpts) IsValid() error {
	if err := o.Cursor.IsValid(); err != nil {
		return err
	}

	// Cursor key must match the active ordering: delta mode (SinceUpdateAt>0)
	// pages by UpdateAt; directory mode pages by CreateAt. A mismatch would
	// silently skip rows because the WHERE clause references the wrong column.
	if !o.Cursor.IsEmpty() {
		deltaMode := o.SinceUpdateAt > 0
		if deltaMode && o.Cursor.UpdateAt == 0 {
			return errors.New("cursor_update_at required when since is set")
		}
		if !deltaMode && o.Cursor.CreateAt == 0 {
			return errors.New("cursor_create_at required when since is not set")
		}
	}

	return nil
}

// PropertyValueSearch captures the parameters provided by a client for
// searching property values.
//
// SinceUpdateAt > 0 switches the endpoint to delta mode: rows are ordered by
// update_at, tombstones are included, and pagination must use CursorUpdateAt
// (CursorCreateAt is used in the default directory mode).
type PropertyValueSearch struct {
	CursorID       string `json:"cursor_id,omitempty"`
	CursorCreateAt int64  `json:"cursor_create_at,omitempty"`
	CursorUpdateAt int64  `json:"cursor_update_at,omitempty"`
	SinceUpdateAt  int64  `json:"since,omitempty"`
	PerPage        int    `json:"per_page"`
}

// PropertyValuePatchItem represents a single field value update in a
// batch PATCH request for property values.
type PropertyValuePatchItem struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}

// SanitizePropertyValue normalizes a raw property value's JSON:
//   - a top-level JSON string has surrounding whitespace trimmed;
//   - a top-level JSON array of strings has each element trimmed and empty
//     entries dropped;
//   - any other shape (numbers, booleans, objects, nested arrays) passes
//     through unchanged.
//
// Returns the original bytes when no change is needed so callers can
// compare by identity if they want to skip writes.
func SanitizePropertyValue(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}

	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		trimmed := strings.TrimSpace(s)
		if trimmed == s {
			return raw
		}
		out, err := json.Marshal(trimmed)
		if err != nil {
			return raw
		}
		return out
	}

	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		filtered := make([]string, 0, len(arr))
		changed := false
		for _, v := range arr {
			t := strings.TrimSpace(v)
			if t != v {
				changed = true
			}
			if t == "" {
				if v != "" {
					changed = true
				}
				continue
			}
			filtered = append(filtered, t)
		}
		if !changed && len(filtered) == len(arr) {
			return raw
		}
		out, err := json.Marshal(filtered)
		if err != nil {
			return raw
		}
		return out
	}

	return raw
}
