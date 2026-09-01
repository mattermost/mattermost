// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file implements the "User Attributes" feature, formerly known as
// "Custom Profile Attributes" (CPA). Internal identifiers retain the old
// naming for backward compatibility with REST APIs, WebSocket events,
// JSON wire formats, and the Property System Architecture (PSA) group name
// "custom_profile_attributes". See MM-68235.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
)

// CPA-prefixed aliases for the canonical PropertyField* constants in
// property_field_attrs_validation.go. Aliasing (not redeclaring) keeps CPA
// writes and property-hook reads keyed on the same string at compile time,
// so a rename to one side cannot silently diverge from the other.
const (
	// Attributes keys
	CustomProfileAttributesPropertyAttrsSortOrder   = PropertyFieldAttrSortOrder
	CustomProfileAttributesPropertyAttrsValueType   = PropertyFieldAttrValueType
	CustomProfileAttributesPropertyAttrsVisibility  = PropertyFieldAttrVisibility
	CustomProfileAttributesPropertyAttrsLDAP        = PropertyFieldAttrLDAP
	CustomProfileAttributesPropertyAttrsSAML        = PropertyFieldAttrSAML
	CustomProfileAttributesPropertyAttrsManaged     = PropertyFieldAttrManaged
	CustomProfileAttributesPropertyAttrsDisplayName = PropertyFieldAttrDisplayName

	// Value Types
	CustomProfileAttributesValueTypeEmail = PropertyFieldValueTypeEmail
	CustomProfileAttributesValueTypeURL   = PropertyFieldValueTypeURL
	CustomProfileAttributesValueTypePhone = PropertyFieldValueTypePhone

	// Visibility
	CustomProfileAttributesVisibilityHidden  = PropertyFieldVisibilityHidden
	CustomProfileAttributesVisibilityWhenSet = PropertyFieldVisibilityWhenSet
	CustomProfileAttributesVisibilityAlways  = PropertyFieldVisibilityAlways
	CustomProfileAttributesVisibilityDefault = CustomProfileAttributesVisibilityWhenSet

	// CPA options
	CPAOptionNameMaxLength  = 128
	CPAOptionColorMaxLength = 128

	// CPA value constraints
	CPAValueTypeTextMaxLength = PropertyFieldValueTypeTextMaxLength
)

// CPAFieldNamePattern defines the character set allowed for CPA field names.
// Matches the CEL IDENTIFIER grammar (^[A-Za-z_][A-Za-z0-9_]*$) used by the
// ABAC engine (cel-go v0.27.0). Leading underscore is permitted — this is consistent
// with both the CEL grammar and the enterprise unparser (identifierPartPattern in
// access_control/cel_utils/normalizer.go).
var CPAFieldNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// CPAFieldNameReservedWords is the set of CEL keywords that cannot be used as CPA
// field names. Bare use of these tokens in member-select position (e.g.
// user.attributes.in) either fails CEL parse or requires backtick quoting that
// the ABAC visual builder (ToCEL) does not currently emit.
//
// List sourced from cel-go v0.27.0 CEL.g4 lexer rules.
// Grouped: literals (true/false/null), operator-keywords (in/as), then alphabetical reserved keywords.
var CPAFieldNameReservedWords = map[string]struct{}{
	"true": {}, "false": {}, "null": {},
	"in": {}, "as": {},
	"break": {}, "const": {}, "continue": {}, "else": {},
	"for": {}, "function": {}, "if": {}, "import": {},
	"let": {}, "loop": {}, "package": {}, "namespace": {},
	"return": {}, "var": {}, "void": {}, "while": {},
}

func ValidateCPAFieldName(name string) *AppError {
	if !CPAFieldNamePattern.MatchString(name) {
		return NewAppError(
			"ValidateCPAFieldName",
			"model.cpa_field.name.invalid_charset.app_error",
			map[string]any{"Name": name},
			"",
			http.StatusUnprocessableEntity,
		)
	}
	if _, reserved := CPAFieldNameReservedWords[name]; reserved {
		return NewAppError(
			"ValidateCPAFieldName",
			"model.cpa_field.name.reserved_word.app_error",
			map[string]any{"Name": name},
			"",
			http.StatusUnprocessableEntity,
		)
	}
	return nil
}

type CustomProfileAttributesSelectOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Rank  *int   `json:"rank,omitempty"`
}

func (c CustomProfileAttributesSelectOption) GetID() string {
	return c.ID
}

func (c CustomProfileAttributesSelectOption) GetName() string {
	return c.Name
}

func (c *CustomProfileAttributesSelectOption) SetID(id string) {
	c.ID = id
}

func (c CustomProfileAttributesSelectOption) IsValid() error {
	if c.ID == "" {
		return errors.New("id cannot be empty")
	}

	if !IsValidId(c.ID) {
		return errors.New("id is not a valid ID")
	}

	if c.Name == "" {
		return errors.New("name cannot be empty")
	}

	if len(c.Name) > CPAOptionNameMaxLength {
		return fmt.Errorf("name is too long, max length is %d", CPAOptionNameMaxLength)
	}

	if c.Color != "" && len(c.Color) > CPAOptionColorMaxLength {
		return fmt.Errorf("color is too long, max length is %d", CPAOptionColorMaxLength)
	}
	return nil
}

type CPAField struct {
	PropertyField
	Attrs CPAAttrs `json:"attrs"`
}

// CPAAttrs holds the typed attributes for a CPA (Custom Profile Attributes) field.
//
// # CEL-safe-identifier validation for Name
//
// CPA field names double as identifiers in ABAC CEL policy expressions of the form
// user.attributes.<name>. To be valid in that position without backtick quoting,
// Name must satisfy [CPAFieldNamePattern] (^[A-Za-z_][A-Za-z0-9_]*$) and must not
// appear in [CPAFieldNameReservedWords].
//
// # DisplayName
//
// DisplayName carries the user-facing label (e.g. "Department Head") separately
// from Name (the CEL identifier, e.g. "department_head").
type CPAAttrs struct {
	Visibility     string                                                `json:"visibility"`
	SortOrder      float64                                               `json:"sort_order"`
	Options        PropertyOptions[*CustomProfileAttributesSelectOption] `json:"options"`
	ValueType      string                                                `json:"value_type"`
	LDAP           string                                                `json:"ldap"`
	SAML           string                                                `json:"saml"`
	Managed        string                                                `json:"managed"`
	Protected      bool                                                  `json:"protected"`
	SourcePluginID string                                                `json:"source_plugin_id"`
	AccessMode     string                                                `json:"access_mode"`
	DisplayName    string                                                `json:"display_name,omitempty"` // omitempty applies only to direct JSON marshal of CPAAttrs; ToPropertyField always writes the key into the underlying StringInterface map.
	// Owners, when set, declares the identities that own this field. A non-empty
	// Owners list governs the field's write-access decision, superseding the
	// legacy protected / SourcePluginID gating and the sync-lock. The list is
	// managed only by an administrator via the REST API; see PropertyOwner.
	Owners []PropertyOwner `json:"owners,omitempty"`
}

func (c *CPAField) IsSynced() bool {
	return c.Attrs.LDAP != "" || c.Attrs.SAML != ""
}

func (c *CPAField) IsAdminManaged() bool {
	return c.Attrs.Managed == "admin"
}

// Patch applies a PropertyFieldPatch to the CPAField by converting to PropertyField,
// applying the patch, and converting back. This ensures we only maintain one patch logic path.
// Custom profile attributes doesn't use targets, so TargetID and TargetType are cleared.
func (c *CPAField) Patch(patch *PropertyFieldPatch) error {
	// Custom profile attributes doesn't use targets
	patch.TargetID = nil
	patch.TargetType = nil

	// Convert to PropertyField
	pf := c.ToPropertyField()

	// Apply the patch using PropertyField's patch logic
	pf.Patch(patch, false)

	// Convert back to CPAField
	patched, err := NewCPAFieldFromPropertyField(pf)
	if err != nil {
		return err
	}

	// Update the current CPAField with patched values
	*c = *patched

	return nil
}

func (c *CPAField) ToPropertyField() *PropertyField {
	pf := c.PropertyField

	pf.Attrs = StringInterface{
		CustomProfileAttributesPropertyAttrsVisibility:  c.Attrs.Visibility,
		CustomProfileAttributesPropertyAttrsSortOrder:   c.Attrs.SortOrder,
		CustomProfileAttributesPropertyAttrsValueType:   c.Attrs.ValueType,
		PropertyFieldAttributeOptions:                   c.Attrs.Options,
		CustomProfileAttributesPropertyAttrsLDAP:        c.Attrs.LDAP,
		CustomProfileAttributesPropertyAttrsSAML:        c.Attrs.SAML,
		CustomProfileAttributesPropertyAttrsManaged:     c.Attrs.Managed,
		PropertyAttrsProtected:                          c.Attrs.Protected,
		PropertyAttrsSourcePluginID:                     c.Attrs.SourcePluginID,
		PropertyAttrsAccessMode:                         c.Attrs.AccessMode,
		CustomProfileAttributesPropertyAttrsDisplayName: c.Attrs.DisplayName,
	}

	// Only write the owners key when the field declares owners, so existing
	// fields keep their attrs blob unchanged and HasPropertyFieldOwners stays
	// false for legacy-managed fields.
	if len(c.Attrs.Owners) > 0 {
		pf.Attrs[PropertyAttrsOwners] = c.Attrs.Owners
	}

	return &pf
}

func NewCPAFieldFromPropertyField(pf *PropertyField) (*CPAField, error) {
	attrsJSON, err := json.Marshal(pf.Attrs)
	if err != nil {
		return nil, err
	}

	var attrs CPAAttrs
	err = json.Unmarshal(attrsJSON, &attrs)
	if err != nil {
		return nil, err
	}

	cpaField := &CPAField{
		PropertyField: *pf,
		Attrs:         attrs,
	}

	return cpaField, nil
}

// CPAFieldsFromPropertyFields converts a slice of PropertyFields to CPAFields
// and sorts the result by Attrs.SortOrder ascending.
func CPAFieldsFromPropertyFields(pfs []*PropertyField) ([]*CPAField, error) {
	cpaFields := make([]*CPAField, 0, len(pfs))
	for _, pf := range pfs {
		cpaField, err := NewCPAFieldFromPropertyField(pf)
		if err != nil {
			return nil, err
		}
		cpaFields = append(cpaFields, cpaField)
	}

	sort.Slice(cpaFields, func(i, j int) bool {
		if cpaFields[i].Attrs.SortOrder != cpaFields[j].Attrs.SortOrder {
			return cpaFields[i].Attrs.SortOrder < cpaFields[j].Attrs.SortOrder
		}
		return cpaFields[i].ID < cpaFields[j].ID
	})

	return cpaFields, nil
}
