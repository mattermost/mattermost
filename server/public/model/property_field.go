// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
)

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
	Attrs      StringInterface   `json:"attrs"`
	TargetID   string            `json:"target_id"`
	TargetType string            `json:"target_type"`
	CreateAt   int64             `json:"create_at"`
	UpdateAt   int64             `json:"update_at"`
	DeleteAt   int64             `json:"delete_at"`
}

func (pf *PropertyField) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":          pf.ID,
		"group_id":    pf.GroupID,
		"name":        pf.Name,
		"type":        pf.Type,
		"attrs":       pf.Attrs,
		"target_id":   pf.TargetID,
		"target_type": pf.TargetType,
		"create_at":   pf.CreateAt,
		"update_at":   pf.UpdateAt,
		"delete_at":   pf.DeleteAt,
	}
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
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "id", "Reason": "invalid id"}, "", http.StatusBadRequest)
	}

	if !IsValidId(pf.GroupID) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "group_id", "Reason": "invalid id"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.Name == "" {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "value cannot be empty"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.Type != PropertyFieldTypeText &&
		pf.Type != PropertyFieldTypeSelect &&
		pf.Type != PropertyFieldTypeMultiselect &&
		pf.Type != PropertyFieldTypeDate &&
		pf.Type != PropertyFieldTypeUser &&
		pf.Type != PropertyFieldTypeMultiuser {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "type", "Reason": "unknown value"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.CreateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "create_at", "Reason": "value cannot be zero"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.UpdateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "update_at", "Reason": "value cannot be zero"}, "id="+pf.ID, http.StatusBadRequest)
	}

	return nil
}

func (pf *PropertyField) SanitizeInput() {
	pf.Name = strings.TrimSpace(pf.Name)
}

type PropertyFieldPatch struct {
	Name       *string            `json:"name"`
	Type       *PropertyFieldType `json:"type"`
	Attrs      *map[string]any    `json:"attrs"`
	TargetID   *string            `json:"target_id"`
	TargetType *string            `json:"target_type"`
}

func (pfp *PropertyFieldPatch) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"name":        pfp.Name,
		"type":        pfp.Type,
		"attrs":       pfp.Attrs,
		"target_id":   pfp.TargetID,
		"target_type": pfp.TargetType,
	}
}

func (pfp *PropertyFieldPatch) SanitizeInput() {
	if pfp.Name != nil {
		pfp.Name = NewPointer(strings.TrimSpace(*pfp.Name))
	}
}

func (pf *PropertyField) Patch(patch *PropertyFieldPatch) {
	if patch.Name != nil {
		pf.Name = *patch.Name
	}

	if patch.Type != nil {
		pf.Type = *patch.Type
	}

	if patch.Attrs != nil {
		pf.Attrs = *patch.Attrs
	}

	if patch.TargetID != nil {
		pf.TargetID = *patch.TargetID
	}

	if patch.TargetType != nil {
		pf.TargetType = *patch.TargetType
	}
}

type PropertyFieldSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetID       string
	IncludeDeleted bool
	Page           int
	PerPage        int
}
