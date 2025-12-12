// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"unicode/utf8"
)

type PropertyFieldType string

const (
	PropertyFieldTypeText        PropertyFieldType = "text"
	PropertyFieldTypeSelect      PropertyFieldType = "select"
	PropertyFieldTypeMultiselect PropertyFieldType = "multiselect"
	PropertyFieldTypeDate        PropertyFieldType = "date"
	PropertyFieldTypeUser        PropertyFieldType = "user"
	PropertyFieldTypeMultiuser   PropertyFieldType = "multiuser"

	PropertyFieldNameMaxRunes       = 255
	PropertyFieldTargetIDMaxRunes   = 255
	PropertyFieldTargetTypeMaxRunes = 255
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

func (pf *PropertyField) Auditable() map[string]any {
	return map[string]any{
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

// PreSave will set the Id if missing. It will also fill in the CreateAt, UpdateAt
// times and ensure DeleteAt is 0. It should be run before saving the field to the db.
func (pf *PropertyField) PreSave() {
	if pf.ID == "" {
		pf.ID = NewId()
	}

	pf.CreateAt = GetMillis()
	pf.UpdateAt = pf.CreateAt
	pf.DeleteAt = 0
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

	if utf8.RuneCountInString(pf.Name) > PropertyFieldNameMaxRunes {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "value exceeds maximum length"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(pf.TargetType) > PropertyFieldTargetTypeMaxRunes {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "value exceeds maximum length"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(pf.TargetID) > PropertyFieldTargetIDMaxRunes {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "value exceeds maximum length"}, "id="+pf.ID, http.StatusBadRequest)
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

type PropertyFieldPatch struct {
	Name       *string            `json:"name"`
	Type       *PropertyFieldType `json:"type"`
	Attrs      *StringInterface   `json:"attrs"`
	TargetID   *string            `json:"target_id"`
	TargetType *string            `json:"target_type"`
}

func (pfp *PropertyFieldPatch) Auditable() map[string]any {
	return map[string]any{
		"name":        pfp.Name,
		"type":        pfp.Type,
		"attrs":       pfp.Attrs,
		"target_id":   pfp.TargetID,
		"target_type": pfp.TargetType,
	}
}

func (pfp *PropertyFieldPatch) IsValid() error {
	if pfp.Name != nil && *pfp.Name == "" {
		return NewAppError("PropertyFieldPatch.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "value cannot be empty"}, "", http.StatusBadRequest)
	}

	if pfp.Name != nil && utf8.RuneCountInString(*pfp.Name) > PropertyFieldNameMaxRunes {
		return NewAppError("PropertyFieldPatch.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "value exceeds maximum length"}, "", http.StatusBadRequest)
	}

	if pfp.TargetType != nil && utf8.RuneCountInString(*pfp.TargetType) > PropertyFieldTargetTypeMaxRunes {
		return NewAppError("PropertyFieldPatch.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "value exceeds maximum length"}, "", http.StatusBadRequest)
	}

	if pfp.TargetID != nil && utf8.RuneCountInString(*pfp.TargetID) > PropertyFieldTargetIDMaxRunes {
		return NewAppError("PropertyFieldPatch.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "value exceeds maximum length"}, "", http.StatusBadRequest)
	}

	if pfp.Type != nil &&
		*pfp.Type != PropertyFieldTypeText &&
		*pfp.Type != PropertyFieldTypeSelect &&
		*pfp.Type != PropertyFieldTypeMultiselect &&
		*pfp.Type != PropertyFieldTypeDate &&
		*pfp.Type != PropertyFieldTypeUser &&
		*pfp.Type != PropertyFieldTypeMultiuser {
		return NewAppError("PropertyFieldPatch.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "type", "Reason": "unknown value"}, "", http.StatusBadRequest)
	}

	return nil
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

type PropertyFieldSearchCursor struct {
	PropertyFieldID string
	CreateAt        int64
}

func (p PropertyFieldSearchCursor) IsEmpty() bool {
	return p.PropertyFieldID == "" && p.CreateAt == 0
}

func (p PropertyFieldSearchCursor) IsValid() error {
	if p.IsEmpty() {
		return nil
	}

	if p.CreateAt <= 0 {
		return errors.New("create at cannot be negative or zero")
	}

	if !IsValidId(p.PropertyFieldID) {
		return errors.New("property field id is invalid")
	}
	return nil
}

type PropertyFieldSearchOpts struct {
	GroupID        string
	TargetType     string
	TargetIDs      []string
	SinceUpdateAt  int64 // UpdatedAt after which to send the items
	IncludeDeleted bool
	Cursor         PropertyFieldSearchCursor
	PerPage        int
}

func (pf *PropertyField) GetAttr(key string) any {
	return pf.Attrs[key]
}

const PropertyFieldAttributeOptions = "options"

type PropertyOption interface {
	GetID() string
	GetName() string
	SetID(id string)
	IsValid() error
}

type PropertyOptions[T PropertyOption] []T

func NewPropertyOptionsFromFieldAttrs[T PropertyOption](optionsArr any) (PropertyOptions[T], error) {
	options := PropertyOptions[T]{}
	b, err := json.Marshal(optionsArr)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal options: %w", err)
	}

	err = json.Unmarshal(b, &options)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal options: %w", err)
	}

	for i := range options {
		if options[i].GetID() == "" {
			options[i].SetID(NewId())
		}
	}

	return options, nil
}

func (p PropertyOptions[T]) IsValid() error {
	if len(p) == 0 {
		return errors.New("options list cannot be empty")
	}

	seenNames := make(map[string]struct{})
	for i, option := range p {
		if err := option.IsValid(); err != nil {
			return fmt.Errorf("invalid option at index %d: %w", i, err)
		}

		if _, exists := seenNames[option.GetName()]; exists {
			return fmt.Errorf("duplicate option name found at index %d: %s", i, option.GetName())
		}
		seenNames[option.GetName()] = struct{}{}
	}

	return nil
}

// PluginPropertyOption provides a simple implementation of PropertyOption for plugins
// using a map[string]string for flexible key-value storage
type PluginPropertyOption struct {
	Data map[string]string `json:"data"`
}

func NewPluginPropertyOption(id, name string) *PluginPropertyOption {
	return &PluginPropertyOption{
		Data: map[string]string{
			"id":   id,
			"name": name,
		},
	}
}

func (p *PluginPropertyOption) GetID() string {
	if p.Data == nil {
		return ""
	}
	return p.Data["id"]
}

func (p *PluginPropertyOption) GetName() string {
	if p.Data == nil {
		return ""
	}
	return p.Data["name"]
}

func (p *PluginPropertyOption) SetID(id string) {
	if p.Data == nil {
		p.Data = make(map[string]string)
	}
	p.Data["id"] = id
}

func (p *PluginPropertyOption) IsValid() error {
	if p.Data == nil {
		return errors.New("data cannot be nil")
	}

	id := p.GetID()
	if id == "" {
		return errors.New("id cannot be empty")
	}

	if !IsValidId(id) {
		return errors.New("id is not a valid ID")
	}

	name := p.GetName()
	if name == "" {
		return errors.New("name cannot be empty")
	}

	return nil
}

// GetValue retrieves a custom value from the option data
func (p *PluginPropertyOption) GetValue(key string) string {
	if p.Data == nil {
		return ""
	}
	return p.Data[key]
}

// SetValue sets a custom value in the option data
func (p *PluginPropertyOption) SetValue(key, value string) {
	if p.Data == nil {
		p.Data = make(map[string]string)
	}
	p.Data[key] = value
}

// MarshalJSON implements custom JSON marshaling to avoid wrapping in "data"
func (p *PluginPropertyOption) MarshalJSON() ([]byte, error) {
	if p.Data == nil {
		return json.Marshal(map[string]string{})
	}
	return json.Marshal(p.Data)
}

// UnmarshalJSON implements custom JSON unmarshaling to handle unwrapped JSON
func (p *PluginPropertyOption) UnmarshalJSON(data []byte) error {
	var result map[string]string
	if err := json.Unmarshal(data, &result); err != nil {
		return err
	}
	p.Data = result
	return nil
}
