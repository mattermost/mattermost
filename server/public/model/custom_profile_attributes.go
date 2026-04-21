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
	"sort"
	"strings"
)

// CPA-prefixed aliases for the canonical PropertyField* constants in
// property_field_attrs_validation.go. Aliasing (not redeclaring) keeps CPA
// writes and property-hook reads keyed on the same string at compile time,
// so a rename to one side cannot silently diverge from the other.
const (
	// Attributes keys
	CustomProfileAttributesPropertyAttrsSortOrder  = PropertyFieldAttrSortOrder
	CustomProfileAttributesPropertyAttrsValueType  = PropertyFieldAttrValueType
	CustomProfileAttributesPropertyAttrsVisibility = PropertyFieldAttrVisibility
	CustomProfileAttributesPropertyAttrsLDAP       = PropertyFieldAttrLDAP
	CustomProfileAttributesPropertyAttrsSAML       = PropertyFieldAttrSAML
	CustomProfileAttributesPropertyAttrsManaged    = PropertyFieldAttrManaged

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

func IsKnownCPAValueType(valueType string) bool {
	switch valueType {
	case CustomProfileAttributesValueTypeEmail,
		CustomProfileAttributesValueTypeURL,
		CustomProfileAttributesValueTypePhone:
		return true
	}

	return false
}

func IsKnownCPAVisibility(visibility string) bool {
	switch visibility {
	case CustomProfileAttributesVisibilityHidden,
		CustomProfileAttributesVisibilityWhenSet,
		CustomProfileAttributesVisibilityAlways:
		return true
	}

	return false
}

type CustomProfileAttributesSelectOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
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
}

func (c *CPAField) IsSynced() bool {
	return c.Attrs.LDAP != "" || c.Attrs.SAML != ""
}

func (c *CPAField) IsAdminManaged() bool {
	return c.Attrs.Managed == "admin"
}

// SetDefaults sets default values for CPAField attributes
func (c *CPAField) SetDefaults() {
	if c.Attrs.Visibility == "" {
		c.Attrs.Visibility = CustomProfileAttributesVisibilityDefault
	}
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
		CustomProfileAttributesPropertyAttrsVisibility: c.Attrs.Visibility,
		CustomProfileAttributesPropertyAttrsSortOrder:  c.Attrs.SortOrder,
		CustomProfileAttributesPropertyAttrsValueType:  c.Attrs.ValueType,
		PropertyFieldAttributeOptions:                  c.Attrs.Options,
		CustomProfileAttributesPropertyAttrsLDAP:       c.Attrs.LDAP,
		CustomProfileAttributesPropertyAttrsSAML:       c.Attrs.SAML,
		CustomProfileAttributesPropertyAttrsManaged:    c.Attrs.Managed,
		PropertyAttrsProtected:                         c.Attrs.Protected,
		PropertyAttrsSourcePluginID:                    c.Attrs.SourcePluginID,
		PropertyAttrsAccessMode:                        c.Attrs.AccessMode,
	}

	return &pf
}

// SupportsOptions checks the CPAField type and determines if the type
// supports the use of options
func (c *CPAField) SupportsOptions() bool {
	return c.Type == PropertyFieldTypeSelect || c.Type == PropertyFieldTypeMultiselect
}

// SupportsSyncing checks the CPAField type and determines if it
// supports syncing with external sources of truth
func (c *CPAField) SupportsSyncing() bool {
	return c.Type == PropertyFieldTypeText
}

func (c *CPAField) SanitizeAndValidate() *AppError {
	c.SetDefaults()

	// first we clean unused attributes depending on the field type
	if !c.SupportsOptions() {
		c.Attrs.Options = nil
	}
	if !c.SupportsSyncing() {
		c.Attrs.LDAP = ""
		c.Attrs.SAML = ""
	}

	// Clear sync properties if managed is set (mutual exclusivity)
	if c.IsAdminManaged() {
		c.Attrs.LDAP = ""
		c.Attrs.SAML = ""
	}

	switch c.Type {
	case PropertyFieldTypeText:
		if valueType := strings.TrimSpace(c.Attrs.ValueType); valueType != "" {
			if !IsKnownCPAValueType(valueType) {
				return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
					"AttributeName": CustomProfileAttributesPropertyAttrsValueType,
					"Reason":        "unknown value type",
				}, "", http.StatusUnprocessableEntity)
			}
			c.Attrs.ValueType = valueType
		}

	case PropertyFieldTypeSelect, PropertyFieldTypeMultiselect:
		options := c.Attrs.Options

		// add an ID to options with no ID
		for i := range options {
			if options[i].ID == "" {
				options[i].ID = NewId()
			}
		}

		if err := options.IsValid(); err != nil {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": PropertyFieldAttributeOptions,
				"Reason":        err.Error(),
			}, "", http.StatusUnprocessableEntity).Wrap(err)
		}
		c.Attrs.Options = options
	}

	// Validate visibility
	if visibilityAttr := strings.TrimSpace(c.Attrs.Visibility); visibilityAttr != "" {
		if !IsKnownCPAVisibility(visibilityAttr) {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsVisibility,
				"Reason":        "unknown visibility",
			}, "", http.StatusUnprocessableEntity)
		}
		c.Attrs.Visibility = visibilityAttr
	}

	// Validate managed field
	if managed := strings.TrimSpace(c.Attrs.Managed); managed != "" {
		if managed != "admin" {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsManaged,
				"Reason":        "unknown managed type",
			}, "", http.StatusBadRequest)
		}
		c.Attrs.Managed = managed
	}

	return nil
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

	cpaField.SetDefaults()

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
