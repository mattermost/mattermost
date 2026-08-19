// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
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
	PropertyFieldTypeRank        PropertyFieldType = "rank"
	// PropertyFieldTypeGraph is a multi-value select whose options are meant to
	// form a hierarchy: one option can stand above another, and access rules are
	// to reason over that relation rather than over exact option equality. An
	// object holds several options at once, as it does for multiselect; there is
	// no single-value variant, which is why the name is unqualified.
	//
	// The hierarchy is held as parent links between options, in
	// PropertyOptionEdges. A graph field's options are served inline like a
	// multiselect field's and read back without any parent information: an
	// option's place in the hierarchy is reported by the endpoints that address
	// options one at a time. A write may state it, though -- see
	// PropertyField.OptionParentLinks.
	PropertyFieldTypeGraph PropertyFieldType = "graph"

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
	// PermissionLevelAdmin resolves to the admin of the field's target: sysadmin
	// for system targets, team admin for team targets, channel admin for
	// channel targets. The specific permission checked per scope is documented
	// at hasPropertyFieldPermissionLevel in the app package.
	PermissionLevelAdmin PermissionLevel = "admin"
	// PermissionLevelEveryone is the most permissive tier: any caller satisfies
	// it (§2.2). It still sits under the object-level check (§2.5), so it is not
	// the same as open access. Added for the permissions model; the legacy
	// permission columns accept it too.
	PermissionLevelEveryone PermissionLevel = "everyone"

	PropertyFieldObjectTypePost     = "post"
	PropertyFieldObjectTypeChannel  = "channel"
	PropertyFieldObjectTypeUser     = "user"
	PropertyFieldObjectTypeTemplate = "template"
	PropertyFieldObjectTypeSession  = "session"

	PropertyFieldObjectTypeSystem = "system"
)

// validPermissionLevels contains all valid PermissionLevel values.
var validPermissionLevels = []PermissionLevel{
	PermissionLevelNone,
	PermissionLevelSysadmin,
	PermissionLevelMember,
	PermissionLevelAdmin,
	PermissionLevelEveryone,
}

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
	PropertyFieldObjectTypeSession,
	PropertyFieldObjectTypeSystem,
}

// optionFieldTypes are the property field types whose `options` attribute is
// meaningful: each stores a list of selectable options. Kept as a single
// allow-list so the "does this field carry options?" check stays consistent
// across the model, API, and access-control layers.
var optionFieldTypes = []PropertyFieldType{
	PropertyFieldTypeSelect,
	PropertyFieldTypeMultiselect,
	PropertyFieldTypeRank,
	PropertyFieldTypeGraph,
}

// SupportsOptions reports whether the field type carries a list of options
// (select, multiselect, rank, graph). Mirrors the webapp's supportsOptions
// helper, which does not list graph: the webapp has no graph authoring UI.
func (t PropertyFieldType) SupportsOptions() bool {
	return slices.Contains(optionFieldTypes, t)
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
	Permissions       *Permissions      `json:"permissions,omitempty"`
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
		"permissions":        pf.Permissions,
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
	if !pf.Type.SupportsOptions() {
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

// PropertyFieldOptionKeyParents is the key an inline option carries the options
// directly above it under. Its value is a list of option *names*: an identifier
// is assigned when an option is created, so a list that creates a hierarchy in
// one write has no identifier to refer to yet, while a name is something the
// caller chose and can refer forwards to.
const PropertyFieldOptionKeyParents = "parents"

// OptionParentLinks returns the parent links the field's inline option list asks
// for, and the options whose parents that list states in full.
//
// A name resolves within the list itself, and nowhere else: the list is the whole
// of the field's option set once the write lands, so an option outside it is
// either about to be removed or belongs to another field. That is also what lets
// one write build a hierarchy, naming an option that appears further down the
// list.
//
// An option with no "parents" key is absent from replacing, because a write that
// says nothing about an option's parents leaves them as they are. The alternative
// -- treating an absent key as "no parents" -- would make an unrelated edit, or a
// read-modify-write of a field read back without parent information, silently turn
// options into roots: an option covered by nothing but itself, which every rule
// that reached it through an option above stops matching.
//
// Run EnsureOptionIDs first. Every option's identifier is taken as given here,
// and so is the field's, which the returned links belong to.
func (pf *PropertyField) OptionParentLinks() (add []*PropertyOptionEdge, replacing []string, err error) {
	options, err := pf.inlineOptions()
	if err != nil || len(options) == 0 {
		return nil, nil, err
	}

	// Two options answering to the same name make every reference to it
	// ambiguous. Only a name actually referenced is refused, so a field whose
	// options are not uniquely named -- which nothing has ever stopped for a type
	// with no hierarchy -- stays writable.
	idsByName := make(map[string]string, len(options))
	ambiguous := make(map[string]bool)
	for _, option := range options {
		name, _ := option["name"].(string)
		if name == "" {
			continue
		}
		if _, taken := idsByName[name]; taken {
			ambiguous[name] = true
			continue
		}
		idsByName[name], _ = option["id"].(string)
	}

	for i, option := range options {
		raw, ok := option[PropertyFieldOptionKeyParents]
		if !ok || raw == nil {
			continue
		}
		if pf.Type != PropertyFieldTypeGraph {
			return nil, nil, fmt.Errorf("the option at index %d carries parents, and the options of a %s field form no hierarchy", i, pf.Type)
		}

		parents, ok := optionParentNames(raw)
		if !ok {
			return nil, nil, fmt.Errorf("the parents of the option at index %d are not a list of option names", i)
		}
		optionID, _ := option["id"].(string)
		if optionID == "" {
			return nil, nil, fmt.Errorf("the option at index %d carries parents but has no id", i)
		}
		replacing = append(replacing, optionID)

		named, _ := option["name"].(string)
		for _, parent := range parents {
			switch {
			case parent == "":
				return nil, nil, fmt.Errorf("the option at index %d is put under an option with no name", i)
			case ambiguous[parent]:
				return nil, nil, fmt.Errorf("the option at index %d is put under %q, and two of the field's options are called that", i, parent)
			case idsByName[parent] == "":
				return nil, nil, fmt.Errorf("the option at index %d is put under %q, which the field has no option called", i, parent)
			case idsByName[parent] == optionID:
				return nil, nil, fmt.Errorf("the option at index %d, %q, is put under itself", i, named)
			}
			add = append(add, &PropertyOptionEdge{
				FieldID:        pf.ID,
				ChildOptionID:  optionID,
				ParentOptionID: idsByName[parent],
			})
		}
	}
	return add, replacing, nil
}

// inlineOptions returns the field's option list as the objects it is made of.
// The shape is the one EnsureOptionIDs normalizes any option list to, so a list
// in any other shape is a caller that did not run it.
func (pf *PropertyField) inlineOptions() ([]map[string]any, error) {
	if pf.Attrs == nil {
		return nil, nil
	}
	raw, ok := pf.Attrs[PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return nil, nil
	}
	list, ok := raw.([]any)
	if !ok {
		return nil, errors.New("the option list is not a list")
	}

	options := make([]map[string]any, 0, len(list))
	for i, item := range list {
		option, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("the option at index %d is not an object", i)
		}
		options = append(options, option)
	}
	return options, nil
}

// optionParentNames reads an inline option's parents key. It arrives as []any of
// string from JSON, and as []string from a Go caller building a field directly.
func optionParentNames(raw any) ([]string, bool) {
	switch value := raw.(type) {
	case []string:
		return value, true
	case []any:
		names := make([]string, 0, len(value))
		for _, item := range value {
			name, ok := item.(string)
			if !ok {
				return nil, false
			}
			names = append(names, name)
		}
		return names, true
	default:
		return nil, false
	}
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

		// System-object fields attach to the system itself; they cannot be scoped below the system level.
		if pf.ObjectType == PropertyFieldObjectTypeSystem && pf.TargetType != string(PropertyFieldTargetLevelSystem) {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "target_type", "Reason": "must be system for system object type"}, "id="+pf.ID, http.StatusBadRequest)
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

		if pf.Permissions != nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permissions", "Reason": "PSAv1 properties cannot have permissions"}, "id="+pf.ID, http.StatusBadRequest)
		}
	}

	if pf.Type != PropertyFieldTypeText &&
		pf.Type != PropertyFieldTypeSelect &&
		pf.Type != PropertyFieldTypeMultiselect &&
		pf.Type != PropertyFieldTypeDate &&
		pf.Type != PropertyFieldTypeUser &&
		pf.Type != PropertyFieldTypeMultiuser &&
		pf.Type != PropertyFieldTypeRank &&
		pf.Type != PropertyFieldTypeGraph {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "type", "Reason": "unknown value"}, "id="+pf.ID, http.StatusBadRequest)
	}

	if pf.Type == PropertyFieldTypeGraph {
		if i := optionIndexCarryingRank(pf.Attrs); i >= 0 {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": fmt.Sprintf("attrs.options[%d].rank", i), "Reason": "rank is not supported on a graph field"}, "id="+pf.ID, http.StatusBadRequest)
		}

		// The list a field is written with is the whole of its option set, so its
		// length is the count the limit is about. A field grown past the limit one
		// option at a time is refused where those options are created instead.
		if count := propertyFieldOptionCount(pf.Attrs); count > PropertyGraphMaxOptions {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "attrs.options", "Reason": fmt.Sprintf("a graph field cannot have more than %d options", PropertyGraphMaxOptions)}, "id="+pf.ID, http.StatusBadRequest)
		}
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

	// The typed permissions object validates (and normalizes) itself against the
	// field's object type. Nothing reads it yet — it rides here unenforced until
	// the decision engine is switched on.
	if pf.Permissions != nil {
		if err := pf.Permissions.IsValid(pf.ObjectType); err != nil {
			return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "permissions", "Reason": err.Error()}, "id="+pf.ID, http.StatusBadRequest)
		}
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
		*pfp.Type != PropertyFieldTypeMultiuser &&
		*pfp.Type != PropertyFieldTypeRank &&
		*pfp.Type != PropertyFieldTypeGraph {
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

// PropertyFieldSearchCursor carries two alternative pagination keys because
// field listings serve two different read patterns:
//
//   - Directory listings (no since filter) page in creation order using
//     CreateAt + PropertyFieldID. CreateAt never changes, so the scan is
//     stable across concurrent patches.
//   - Delta sync (SinceUpdateAt > 0) pages in update order using UpdateAt +
//     PropertyFieldID, matching the ORDER BY the store applies in that mode.
//
// IsValid requires exactly one of CreateAt or UpdateAt to be positive
// alongside a valid PropertyFieldID. An empty cursor is also valid and means
// "start from the beginning".
type PropertyFieldSearchCursor struct {
	PropertyFieldID string
	CreateAt        int64
	UpdateAt        int64
}

func (p PropertyFieldSearchCursor) IsEmpty() bool {
	return p.PropertyFieldID == "" && p.CreateAt == 0 && p.UpdateAt == 0
}

func (p PropertyFieldSearchCursor) IsValid() error {
	if p.IsEmpty() {
		return nil
	}

	if !IsValidId(p.PropertyFieldID) {
		return errors.New("property field id is invalid")
	}

	hasCreate := p.CreateAt > 0
	hasUpdate := p.UpdateAt > 0
	if hasCreate == hasUpdate {
		return errors.New("cursor must have exactly one of create_at or update_at set")
	}
	return nil
}

// PropertyFieldSearch captures the parameters provided by a client for
// searching property fields.
//
// Scope is specified one of two ways (mutually exclusive):
//   - Hierarchical: ChannelID and/or TeamID — returns rows at the named scope
//     plus every ancestor above it.
//   - Single-target: TargetType + TargetID — returns rows for exactly one
//     resource.
//
// SinceUpdateAt > 0 switches the endpoint to delta mode: rows are ordered by
// update_at, tombstones are included, and pagination must use CursorUpdateAt
// (CursorCreateAt is used in the default directory mode).
type PropertyFieldSearch struct {
	ObjectTypes    []string `json:"object_types,omitempty"`
	TargetType     string   `json:"target_type,omitempty"`
	TargetID       string   `json:"target_id,omitempty"`
	ChannelID      string   `json:"channel_id,omitempty"`
	TeamID         string   `json:"team_id,omitempty"`
	SinceUpdateAt  int64    `json:"since,omitempty"`
	CursorID       string   `json:"cursor_id,omitempty"`
	CursorCreateAt int64    `json:"cursor_create_at,omitempty"`
	CursorUpdateAt int64    `json:"cursor_update_at,omitempty"`
	PerPage        int      `json:"per_page"`
}

// PropertyFieldSearchOpts captures the filters accepted by SearchPropertyFields.
//
// Invariants enforced by IsValid:
//   - ObjectType and ObjectTypes are mutually exclusive.
//   - Every entry in ObjectTypes must be a valid PSAv2 object type.
//   - ChannelID/TeamID and TargetType/TargetIDs are mutually exclusive scope modes.
//   - ChannelID requires TeamID (callers must resolve TeamID before search).
//   - SinceUpdateAt <= 0 means "no filter".
type PropertyFieldSearchOpts struct {
	GroupID string
	// Deprecated: use ObjectTypes instead. Kept for backwards compatibility
	// with existing callers; mutually exclusive with ObjectTypes.
	ObjectType     string
	ObjectTypes    []string
	TargetType     string
	TargetIDs      []string
	ChannelID      string
	TeamID         string
	LinkedFieldID  string
	SinceUpdateAt  int64
	IncludeDeleted bool
	Cursor         PropertyFieldSearchCursor
	PerPage        int
}

// IsValid runs the cross-field invariants documented on PropertyFieldSearchOpts.
func (o PropertyFieldSearchOpts) IsValid() error {
	if o.ObjectType != "" && len(o.ObjectTypes) > 0 {
		return errors.New("object_type and object_types are mutually exclusive")
	}

	if o.ObjectType != "" && !IsValidPropertyFieldObjectType(o.ObjectType) {
		return fmt.Errorf("invalid object_type %q", o.ObjectType)
	}

	for _, ot := range o.ObjectTypes {
		if !IsValidPropertyFieldObjectType(ot) {
			return fmt.Errorf("invalid object_type %q", ot)
		}
	}

	scopeByChanTeam := o.ChannelID != "" || o.TeamID != ""
	scopeByTarget := o.TargetType != "" || len(o.TargetIDs) > 0
	if scopeByChanTeam && scopeByTarget {
		return errors.New("channel_id/team_id cannot be combined with target_type/target_id")
	}

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

func (pf *PropertyField) GetAttr(key string) any {
	return pf.Attrs[key]
}

const PropertyFieldAttributeOptions = "options"

// A field's options are stored as rows and inlined into
// Attrs[PropertyFieldAttributeOptions] when the field is read. Past
// PropertyFieldMaxHydratedOptions that would be an unbounded amount of JSON on
// every field listing, so the options are left out and replaced by these two
// keys: the number of options the field actually has, and a marker saying the
// list was withheld rather than empty. Never an error — a field with too many
// options must still list.
const (
	PropertyFieldAttributeOptionsCount   = "options_count"
	PropertyFieldAttributeOptionsOmitted = "options_omitted"

	PropertyFieldMaxHydratedOptions = 1000
)

// PropertyFieldOptionsOmitted reports whether these attrs came from a read that
// left the option list out because the field has more than
// PropertyFieldMaxHydratedOptions of them. The options key is absent in that
// case exactly as it is for a field with no options at all, so anything that
// treats an absent list as "this field has none" has to ask this first.
func PropertyFieldOptionsOmitted(attrs StringInterface) bool {
	omitted, _ := attrs[PropertyFieldAttributeOptionsOmitted].(bool)
	return omitted
}

// HideOptions empties the field's option list and removes the keys that report a
// withheld one, so a masked field discloses neither option names nor how many
// options exist. Mutates in place — call it on a copy, never on a field another
// caller (or a cache) still holds.
func (pf *PropertyField) HideOptions() {
	if pf.Attrs == nil {
		pf.Attrs = make(StringInterface, 1)
	}
	pf.Attrs[PropertyFieldAttributeOptions] = []any{}
	delete(pf.Attrs, PropertyFieldAttributeOptionsCount)
	delete(pf.Attrs, PropertyFieldAttributeOptionsOmitted)
}

// PropertyFieldSuppliesOptions reports whether these attrs carry a non-empty
// option list — a caller asserting what the field's options should be, as
// opposed to one that left the key out or echoed back an empty list because the
// list it read was withheld.
func PropertyFieldSuppliesOptions(attrs StringInterface) bool {
	return propertyFieldOptionCount(attrs) > 0
}

// propertyFieldOptionCount reports how many options an option list carries.
// Counted through reflection rather than a type switch because the key
// legitimately holds any slice shape: []any from JSON, []map[string]any from Go
// callers, or a typed PropertyOptions. Anything that is not a list carries no
// options.
func propertyFieldOptionCount(attrs StringInterface) int {
	options, ok := attrs[PropertyFieldAttributeOptions]
	if !ok || options == nil {
		return 0
	}
	v := reflect.ValueOf(options)
	switch v.Kind() {
	case reflect.Slice, reflect.Array:
		return v.Len()
	default:
		return 0
	}
}

// optionIndexCarryingRank returns the position of the first inline option that
// carries a non-null "rank", or -1 if none does. Used to keep ranks off the
// types they mean nothing for: the option store promotes the key into a column
// of its own for every option-bearing type, so an unwanted rank does not stay
// inert — it is persisted, served back, and reads as an ordering the field does
// not have.
//
// Decoded through JSON because the options key legitimately holds several
// shapes (see PropertyFieldSuppliesOptions). A list that will not decode is
// reported as carrying no rank rather than as an error: the field-level callers
// run EnsureOptionIDs first, which rejects an undecodable list with a message
// about the real problem.
func optionIndexCarryingRank(attrs StringInterface) int {
	raw, ok := attrs[PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return -1
	}

	encoded, err := json.Marshal(raw)
	if err != nil {
		return -1
	}
	var options []map[string]any
	if err := json.Unmarshal(encoded, &options); err != nil {
		return -1
	}

	for i, option := range options {
		if rank, ok := option["rank"]; ok && rank != nil {
			return i
		}
	}
	return -1
}

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
