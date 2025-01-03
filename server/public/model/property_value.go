// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

type PropertyValue struct {
	ID         string `json:"id"`
	TargetID   string `json:"target_id"`
	TargetType string `json:"target_type"`
	GroupID    string `json:"group_id"`
	FieldID    string `json:"field_id"`
	Value      string `json:"value"`
	CreateAt   int64  `json:"create_at"`
	UpdateAt   int64  `json:"update_at"`
	DeleteAt   int64  `json:"delete_at"`
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
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pv.TargetID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.target_id.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.TargetType == "" {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.target_type.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
	}

	if !IsValidId(pv.GroupID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.group_id.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
	}

	if !IsValidId(pv.FieldID) {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.field_id.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.CreateAt == 0 {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.create_at.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
	}

	if pv.UpdateAt == 0 {
		return NewAppError("PropertyValue.IsValid", "model.property_value.is_valid.update_at.app_error", nil, "id="+pv.ID, http.StatusBadRequest)
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
