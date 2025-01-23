// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
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

	if !IsValidId(pv.TargetID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "invalid id"}, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.TargetType == "" {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "value cannot be empty"}, "id="+pv.ID, http.StatusBadRequest)
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

type PropertyValueSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetID       string
	FieldID        string
	IncludeDeleted bool
	Page           int
	PerPage        int
}
