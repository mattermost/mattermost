// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const CustomProfileAttributesPropertyAttrsSortOrder = "sort_order"

func CustomProfileAttributesPropertySortOrder(p *PropertyField) int {
	value, ok := p.Attrs[CustomProfileAttributesPropertyAttrsSortOrder]
	if !ok {
		return 0
	}

	order, ok := value.(float64)
	if !ok {
		return 0
	}

	return int(order)
}

const (
	CustomProfileAttributesPropertyAttrsValueType  = "value_type"
	CustomProfileAttributesPropertyAttrsVisibility = "visibility"
	CustomProfileAttributesPropertyAttrsLDAP       = "ldap"
	CustomProfileAttributesPropertyAttrsSAML       = "saml"
)

const (
	CustomProfileAttributesValueTypeEmail = "email"
	CustomProfileAttributesValueTypeURL   = "url"
	CustomProfileAttributesValueTypePhone = "phone"
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

const (
	CustomProfileAttributesVisibilityHidden  = "hidden"
	CustomProfileAttributesVisibilityWhenSet = "when_set"
	CustomProfileAttributesVisibilityAlways  = "always"

	CustomProfileAttributesVisibilityDefault = CustomProfileAttributesVisibilityWhenSet
)

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

	return nil
}

type CPAField struct {
	PropertyField
	Attrs CPAAttrs
}

type CPAAttrs struct {
	Visibility string                                                `json:"visibility"`
	SortOrder  string                                                `json:"sort_order"`
	Options    PropertyOptions[*CustomProfileAttributesSelectOption] `json:"options"`
	ValueType  string                                                `json:"value_type"`
	LDAP       string                                                `json:"ldap"`
	SAML       string                                                `json:"saml"`
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

func (c *CPAField) Sanitize() *AppError {
	switch c.Type {
	case PropertyFieldTypeText:
		if valueType := strings.TrimSpace(c.Attrs.ValueType); valueType != "" {
			if !IsKnownCPAValueType(valueType) {
				return NewAppError("ValidateCPAField", "app.custom_profile_attributes.unknown_value_type.app_error", map[string]any{"ValueType": valueType}, "", http.StatusUnprocessableEntity)
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
			return NewAppError("ValidateCPAField", "app.custom_profile_attributes.invalid_options.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
		}
		c.Attrs.Options = options
	}

	visibility := CustomProfileAttributesVisibilityDefault
	if visibilityAttr := strings.TrimSpace(c.Attrs.Visibility); visibilityAttr != "" {
		if !IsKnownCPAVisibility(visibilityAttr) {
			return NewAppError("ValidateCPAField", "app.custom_profile_attributes.unknown_visibility.app_error", map[string]any{"Visibility": visibilityAttr}, "", http.StatusUnprocessableEntity)
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
