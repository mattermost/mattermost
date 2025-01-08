// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

type PropertyFieldType string

const (
	PropertyFieldTypeText        PropertyFieldType = "text"
	PropertyFieldTypeSelect      PropertyFieldType = "select"
	PropertyFieldTypeMultiselect PropertyFieldType = "multiselect"
	PropertyFieldTypeDate        PropertyFieldType = "date"
	PropertyFieldTypeUser        PropertyFieldType = "user"
	PropertyFieldTypeMultiuser   PropertyFieldType = "multiuser"
)

type PropertyField struct {
	ID         string            `json:"id"`
	GroupID    string            `json:"group_id"`
	Name       string            `json:"name"`
	Type       PropertyFieldType `json:"type"`
	Attrs      StringMap         `json:"attrs"`
	TargetID   string            `json:"target_id"`
	TargetType string            `json:"target_type"`
	CreateAt   int64             `json:"create_at"`
	UpdateAt   int64             `json:"update_at"`
	DeleteAt   int64             `json:"delete_at"`
}

func (pf *PropertyField) PreSave() {
	if pf.ID == "" {
		pf.ID = NewId()
	}

	if pf.CreateAt == 0 {
		pf.CreateAt = GetMillis()
	}
	pf.UpdateAt = pf.CreateAt
}

func (pf *PropertyField) IsValid() error {
	if !IsValidId(pf.ID) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pf.GroupID) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.group_id.app_error", nil, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.Name == "" {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.name.app_error", nil, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.Type == "" {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.type.app_error", nil, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.CreateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.create_at.app_error", nil, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.UpdateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.update_at.app_error", nil, "id="+pf.ID, http.StatusBadRequest)
	}

	return nil
}

type PropertyFieldSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetID       string
	IncludeDeleted bool
	Page           int
	PerPage        int
}
