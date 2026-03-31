// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"unicode/utf8"
)

type PropertyFieldType string

// PropertyFieldTargetLevel represents the hierarchy level of a property field.
// Used both for TargetType field values and for conflict detection results.
type PropertyFieldTargetLevel string

// PermissionLevel represents the access level for property field operations
type PermissionLevel string

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
	PropertyFieldObjectTypeMaxRunes = 255

	PropertyFieldTargetLevelSystem  PropertyFieldTargetLevel = "system"
	PropertyFieldTargetLevelTeam    PropertyFieldTargetLevel = "team"
	PropertyFieldTargetLevelChannel PropertyFieldTargetLevel = "channel"

	PermissionLevelNone     PermissionLevel = "none"
	PermissionLevelSysadmin PermissionLevel = "sysadmin"
	PermissionLevelMember   PermissionLevel = "member"

	PropertyFieldObjectTypePost     = "post"
	PropertyFieldObjectTypeChannel  = "channel"
	PropertyFieldObjectTypeUser     = "user"
	PropertyFieldObjectTypeTemplate = "template"
)

// validPermissionLevels contains all valid PermissionLevel values.
var validPermissionLevels = []PermissionLevel{PermissionLevelNone, PermissionLevelSysadmin, PermissionLevelMember}

// validPSAv2TargetTypes contains all valid TargetType values for PSAv2 properties.
var validPSAv2TargetTypes = []string{
	string(PropertyFieldTargetLevelSystem),
	string(PropertyFieldTargetLevelTeam),
	string(PropertyFieldTargetLevelChannel),
}

// validPropertyFieldObjectTypes contains all valid ObjectType values for PSAv2 properties.
var validPropertyFieldObjectTypes = []string{
	PropertyFieldObjectTypePost,
	PropertyFieldObjectTypeChannel,
	PropertyFieldObjectTypeUser,
	PropertyFieldObjectTypeTemplate,
}

type PropertyField struct {
	ID                string            `json:"id"`
	GroupID           string            `json:"group_id"`
	Name              string            `json:"name"`
	Type              PropertyFieldType `json:"type"`
	Attrs             StringInterface   `json:"attrs"`
	TargetID          string            `json:"target_id"`
	TargetType        string            `json:"target_type"`
	ObjectType        string            `json:"object_type"`
	Protected         bool              `json:"protected"`
	PermissionField   *PermissionLevel  `json:"permission_field,omitempty"`
	PermissionValues  *PermissionLevel  `json:"permission_values,omitempty"`
	PermissionOptions *PermissionLevel  `json:"permission_options,omitempty"`
	LinkedFieldID     *string           `json:"linked_field_id,omitempty"`
	CreateAt          int64             `json:"create_at"`
	UpdateAt          int64             `json:"update_at"`
	DeleteAt          int64             `json:"delete_at"`
	CreatedBy         string            `json:"created_by"`
	UpdatedBy         string            `json:"updated_by"`
}

func (pf *PropertyField) Auditable() map[string]any {
	return map[string]any{
		"id":                 pf.ID,
		"group_id":           pf.GroupID,
		"name":               pf.Name,
		"type":               pf.Type,
		"attrs":              pf.Attrs,
		"target_id":          pf.TargetID,
		"target_type":        pf.TargetType,
		"object_type":        pf.ObjectType,
		"protected":          pf.Protected,
		"permission_field":   pf.PermissionField,
		"permission_values":  pf.PermissionValues,
		"permission_options": pf.PermissionOptions,
		"linked_field_id":    pf.LinkedFieldID,
		"create_at":          pf.CreateAt,
		"update_at":          pf.UpdateAt,
		"delete_at":          pf.DeleteAt,
		"created_by":         pf.CreatedBy,
		"updated_by":         pf.UpdatedBy,
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

// EnsureOptionIDs generates IDs for any options that don't have them in select/multiselect fields.
// This ensures option IDs are always set, similar to how field IDs are auto-generated.
func (pf *PropertyField) EnsureOptionIDs() error {
	if pf.Type != PropertyFieldTypeSelect && pf.Type != PropertyFieldTypeMultiselect {
		return nil
	}

	if pf.Attrs == nil {
		return nil
	}

	optionsRaw, ok := pf.Attrs[PropertyFieldAttributeOptions]
	if !ok {
		return nil
	}

	// Normalize with JSON to handle any slice type
	optionsBytes, err := json.Marshal(optionsRaw)
	if err != nil {
		return fmt.Errorf("failed to marshal options for field ID %s: %w", pf.ID, err)
	}

	var options []map[string]any
	if err := json.Unmarshal(optionsBytes, &options); err != nil {
		return fmt.Errorf("invalid options format for field ID %s: %w", pf.ID, err)
	}

	for _, optMap := range options {
		if id, ok := optMap["id"].(string); !ok || id == "" {
			optMap["id"] = NewId()
		}
	}

	// Convert back to []any to maintain type compatibility
	optionsAny := make([]any, len(options))
	for i, opt := range options {
		optionsAny[i] = opt
	}
	pf.Attrs[PropertyFieldAttributeOptions] = optionsAny

	return nil
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

	if utf8.RuneCountInString(pf.ObjectType) > PropertyFieldObjectTypeMaxRunes {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "object_type", "Reason": "value exceeds maximum length"}, "id="+pf.ID, http.StatusBadRequest)
	}

	// PSAv2-specific validations: ObjectType, TargetType, and TargetType/TargetID consistency
	if pf.IsPSAv2() {
		if !IsValidPropertyFieldObjectType(pf.ObjectType) {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "object_type", "Reason": "unknown value"}, "id="+pf.ID, http.StatusBadRequest)
		}

		if !IsValidPSAv2PropertyFieldTargetType(pf.TargetType) {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "unknown value"}, "id="+pf.ID, http.StatusBadRequest)
		}

		switch pf.TargetType {
		case string(PropertyFieldTargetLevelSystem):
			if pf.TargetID != "" {
				return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "must be empty for system target type"}, "id="+pf.ID, http.StatusBadRequest)
			}
		case string(PropertyFieldTargetLevelTeam), string(PropertyFieldTargetLevelChannel):
			if !IsValidId(pf.TargetID) {
				return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_id", "Reason": "must be a valid ID for team or channel target type"}, "id="+pf.ID, http.StatusBadRequest)
			}
		}
	} else {
		// PSAv1 properties cannot have permissions or be protected
		if pf.Protected {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "protected", "Reason": "PSAv1 properties cannot be protected"}, "id="+pf.ID, http.StatusBadRequest)
		}

		if pf.PermissionField != nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_field", "Reason": "PSAv1 properties cannot have permissions"}, "id="+pf.ID, http.StatusBadRequest)
		}

		if pf.PermissionValues != nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_values", "Reason": "PSAv1 properties cannot have permissions"}, "id="+pf.ID, http.StatusBadRequest)
		}

		if pf.PermissionOptions != nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_options", "Reason": "PSAv1 properties cannot have permissions"}, "id="+pf.ID, http.StatusBadRequest)
		}
	}

	if pf.Type != PropertyFieldTypeText &&
		pf.Type != PropertyFieldTypeSelect &&
		pf.Type != PropertyFieldTypeMultiselect &&
		pf.Type != PropertyFieldTypeDate &&
		pf.Type != PropertyFieldTypeUser &&
		pf.Type != PropertyFieldTypeMultiuser {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "type", "Reason": "unknown value"}, "id="+pf.ID, http.StatusBadRequest)
	}

	// LinkedFieldID validation: if set, must be a valid 26-char ID.
	// Empty string is allowed as a transient signal for unlinking; callers
	// must canonicalize it to nil before persistence.
	if pf.LinkedFieldID != nil && *pf.LinkedFieldID != "" && !IsValidId(*pf.LinkedFieldID) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "linked_field_id", "Reason": "invalid id"}, "id="+pf.ID, http.StatusBadRequest)
	}

	// Template fields are canonical schema definitions and must not link to other fields
	if pf.ObjectType == PropertyFieldObjectTypeTemplate && pf.LinkedFieldID != nil && *pf.LinkedFieldID != "" {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "linked_field_id", "Reason": "template fields cannot have a linked field"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.CreateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "create_at", "Reason": "value cannot be zero"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.UpdateAt == 0 {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "update_at", "Reason": "value cannot be zero"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.PermissionField != nil && !slices.Contains(validPermissionLevels, *pf.PermissionField) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_field", "Reason": "invalid permission level"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.PermissionValues != nil && !slices.Contains(validPermissionLevels, *pf.PermissionValues) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_values", "Reason": "invalid permission level"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.PermissionOptions != nil && !slices.Contains(validPermissionLevels, *pf.PermissionOptions) {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_options", "Reason": "invalid permission level"}, "id="+pf.ID, http.StatusBadRequest)
	}

	// Cross-validation: protected fields must have field permission set to "none"
	if pf.Protected {
		if pf.PermissionField == nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_field", "Reason": "protected fields must have explicit permissions with field set to none"}, "id="+pf.ID, http.StatusBadRequest)
		}
		if *pf.PermissionField != PermissionLevelNone {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_field", "Reason": "protected fields must have field permission set to none"}, "id="+pf.ID, http.StatusBadRequest)
		}
	}

	// Cross-validation: non-protected fields cannot have field permission set to "none"
	if !pf.Protected && pf.PermissionField != nil && *pf.PermissionField == PermissionLevelNone {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permission_field", "Reason": "non-protected fields cannot have field permission set to none"}, "id="+pf.ID, http.StatusBadRequest)
	}

	return nil
}

type PropertyFieldPatch struct {
	Name          *string            `json:"name"`
	Type          *PropertyFieldType `json:"type"`
	Attrs         *StringInterface   `json:"attrs"`
	TargetID      *string            `json:"target_id"`
	TargetType    *string            `json:"target_type"`
	LinkedFieldID *string            `json:"linked_field_id,omitempty"`
}

func (pfp *PropertyFieldPatch) Auditable() map[string]any {
	return map[string]any{
		"name":            pfp.Name,
		"type":            pfp.Type,
		"attrs":           pfp.Attrs,
		"target_id":       pfp.TargetID,
		"target_type":     pfp.TargetType,
		"linked_field_id": pfp.LinkedFieldID,
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

// Patch applies a PropertyFieldPatch to the field. When mergeAttrs is true,
// only the keys present in the patch are updated in Attrs, with nil values
// deleting keys. When false, Attrs is replaced wholesale.
func (pf *PropertyField) Patch(patch *PropertyFieldPatch, mergeAttrs bool) {
	if patch.Name != nil {
		pf.Name = *patch.Name
	}

	if patch.Type != nil {
		pf.Type = *patch.Type
	}

	if patch.Attrs != nil {
		if mergeAttrs {
			if pf.Attrs == nil {
				pf.Attrs = make(StringInterface)
			}
			for key, value := range *patch.Attrs {
				if value == nil {
					delete(pf.Attrs, key)
				} else {
					pf.Attrs[key] = value
				}
			}
		} else {
			pf.Attrs = *patch.Attrs
		}
	}

	if patch.TargetID != nil {
		pf.TargetID = *patch.TargetID
	}

	if patch.TargetType != nil {
		pf.TargetType = *patch.TargetType
	}

	if patch.LinkedFieldID != nil {
		if *patch.LinkedFieldID == "" {
			// Empty string means unlink — clear to NULL
			pf.LinkedFieldID = nil
		} else {
			pf.LinkedFieldID = patch.LinkedFieldID
		}
	}
}

// IsPSAv1 returns true if this property field uses the legacy PSAv1 schema.
// Legacy properties have an empty ObjectType and rely on simple TargetID uniqueness
// enforced by the idx_propertyfields_unique_legacy database constraint, rather than
// the hierarchical uniqueness model used by PSAv2 (ObjectType-based) properties.
func (pf *PropertyField) IsPSAv1() bool {
	return pf.ObjectType == ""
}

// IsPSAv2 returns true if this property field uses the PSAv2 schema.
// PSAv2 properties have a non-empty ObjectType and use hierarchical
// uniqueness based on ObjectType, TargetType, and TargetID.
func (pf *PropertyField) IsPSAv2() bool {
	return pf.ObjectType != ""
}

// IsValidPSAv2PropertyFieldTargetType checks if the given TargetType string is a valid
// PSAv2 target level
func IsValidPSAv2PropertyFieldTargetType(targetType string) bool {
	return slices.Contains(validPSAv2TargetTypes, targetType)
}

// IsValidPropertyFieldObjectType checks if the given ObjectType string is a valid
// property field object type
func IsValidPropertyFieldObjectType(objectType string) bool {
	return slices.Contains(validPropertyFieldObjectTypes, objectType)
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

// PropertyFieldSearch captures the parameters provided by a client for
// searching property fields
type PropertyFieldSearch struct {
	TargetType     string `json:"target_type,omitempty"`
	TargetID       string `json:"target_id,omitempty"`
	CursorID       string `json:"cursor_id,omitempty"`
	CursorCreateAt int64  `json:"cursor_create_at,omitempty"`
	PerPage        int    `json:"per_page"`
}

type PropertyFieldSearchOpts struct {
	GroupID        string
	ObjectType     string
	TargetType     string
	TargetIDs      []string
	LinkedFieldID  string
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
