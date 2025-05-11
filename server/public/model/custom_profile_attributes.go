// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

func CPASortOrder(p *PropertyField) int {
	value, ok := p.Attrs[CustomProfileAttributesPropertyAttrsSortOrder]
	if !ok {
		return 0
	}

	sortOrder, ok := value.(float64)
	if !ok {
		return 0
	}

	return int(sortOrder)
}

const (
	// Attributes keys
	CustomProfileAttributesPropertyAttrsSortOrder  = "sort_order"
	CustomProfileAttributesPropertyAttrsValueType  = "value_type"
	CustomProfileAttributesPropertyAttrsVisibility = "visibility"
	CustomProfileAttributesPropertyAttrsLDAP       = "ldap"
	CustomProfileAttributesPropertyAttrsSAML       = "saml"

	// Value Types
	CustomProfileAttributesValueTypeEmail = "email"
	CustomProfileAttributesValueTypeURL   = "url"
	CustomProfileAttributesValueTypePhone = "phone"

	// Visibility
	CustomProfileAttributesVisibilityHidden  = "hidden"
	CustomProfileAttributesVisibilityWhenSet = "when_set"
	CustomProfileAttributesVisibilityAlways  = "always"
	CustomProfileAttributesVisibilityDefault = CustomProfileAttributesVisibilityWhenSet

	// CPA options
	CPAOptionNameMaxLength  = 128
	CPAOptionColorMaxLength = 128

	// CPA value constraints
	CPAValueTypeTextMaxLength = 64
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
	Visibility string                                                `json:"visibility"`
	SortOrder  float64                                               `json:"sort_order"`
	Options    PropertyOptions[*CustomProfileAttributesSelectOption] `json:"options"`
	ValueType  string                                                `json:"value_type"`
	LDAP       string                                                `json:"ldap"`
	SAML       string                                                `json:"saml"`
}

func (c *CPAField) IsSynced() bool {
	return c.Attrs.LDAP != "" || c.Attrs.SAML != ""
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
	// first we clean unused attributes depending on the field type
	if !c.SupportsOptions() {
		c.Attrs.Options = nil
	}
	if !c.SupportsSyncing() {
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

	visibility := CustomProfileAttributesVisibilityDefault
	if visibilityAttr := strings.TrimSpace(c.Attrs.Visibility); visibilityAttr != "" {
		if !IsKnownCPAVisibility(visibilityAttr) {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsVisibility,
				"Reason":        "unknown visibility",
			}, "", http.StatusUnprocessableEntity)
		}
		visibility = visibilityAttr
	}
	c.Attrs.Visibility = visibility

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

	return &CPAField{
		PropertyField: *pf,
		Attrs:         attrs,
	}, nil
}

// SanitizeAndValidatePropertyValue validates and sanitizes the given
// property value based on the field type
func SanitizeAndValidatePropertyValue(cpaField *CPAField, rawValue json.RawMessage) (json.RawMessage, error) {
	fieldType := cpaField.Type

	// build a list of existing options so we can check later if the values exist
	optionsMap := map[string]struct{}{}
	for _, v := range cpaField.Attrs.Options {
		optionsMap[v.ID] = struct{}{}
	}

	switch fieldType {
	case PropertyFieldTypeText, PropertyFieldTypeDate, PropertyFieldTypeSelect, PropertyFieldTypeUser:
		var value string
		if err := json.Unmarshal(rawValue, &value); err != nil {
			return nil, err
		}
		value = strings.TrimSpace(value)

		if fieldType == PropertyFieldTypeText {
			if len(value) > CPAValueTypeTextMaxLength {
				return nil, fmt.Errorf("value too long")
			}

			if cpaField.Attrs.ValueType == CustomProfileAttributesValueTypeEmail && !IsValidEmail(value) {
				return nil, fmt.Errorf("invalid email")
			}

			if cpaField.Attrs.ValueType == CustomProfileAttributesValueTypeURL {
				_, err := url.Parse(value)
				if err != nil {
					return nil, fmt.Errorf("invalid url: %w", err)
				}
			}
		}

		if fieldType == PropertyFieldTypeSelect && value != "" {
			if _, ok := optionsMap[value]; !ok {
				return nil, fmt.Errorf("option \"%s\" does not exist", value)
			}
		}

		if fieldType == PropertyFieldTypeUser && value != "" && !IsValidId(value) {
			return nil, fmt.Errorf("invalid user id")
		}
		return json.Marshal(value)

	case PropertyFieldTypeMultiselect, PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(rawValue, &values); err != nil {
			return nil, err
		}
		filteredValues := make([]string, 0, len(values))
		for _, v := range values {
			trimmed := strings.TrimSpace(v)
			if trimmed == "" {
				continue
			}
			if fieldType == PropertyFieldTypeMultiselect {
				if _, ok := optionsMap[v]; !ok {
					return nil, fmt.Errorf("option \"%s\" does not exist", v)
				}
			}

			if fieldType == PropertyFieldTypeMultiuser && !IsValidId(trimmed) {
				return nil, fmt.Errorf("invalid user id: %s", trimmed)
			}
			filteredValues = append(filteredValues, trimmed)
		}
		return json.Marshal(filteredValues)

	default:
		return nil, fmt.Errorf("unknown field type: %s", fieldType)
	}
}
