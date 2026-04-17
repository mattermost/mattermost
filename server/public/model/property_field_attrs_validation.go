// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// Attribute keys used across property groups. These are the canonical keys
// stored in PropertyField.Attrs and referenced by hooks.
const (
	PropertyFieldAttrVisibility = "visibility"
	PropertyFieldAttrSortOrder  = "sort_order"
	PropertyFieldAttrValueType  = "value_type"
	PropertyFieldAttrLDAP       = "ldap"
	PropertyFieldAttrSAML       = "saml"
	PropertyFieldAttrManaged    = "managed"
)

// Valid visibility values for property fields.
const (
	PropertyFieldVisibilityHidden  = "hidden"
	PropertyFieldVisibilityWhenSet = "when_set"
	PropertyFieldVisibilityAlways  = "always"
)

// Valid value types for text property fields.
const (
	PropertyFieldValueTypeEmail = "email"
	PropertyFieldValueTypeURL   = "url"
	PropertyFieldValueTypePhone = "phone"
)

// PropertyFieldValueTypeTextMaxLength is the maximum character length for text field values.
const PropertyFieldValueTypeTextMaxLength = 64

// IsValidPropertyFieldVisibility reports whether the given string is a known visibility value.
func IsValidPropertyFieldVisibility(v string) bool {
	switch v {
	case PropertyFieldVisibilityHidden,
		PropertyFieldVisibilityWhenSet,
		PropertyFieldVisibilityAlways:
		return true
	default:
		return false
	}
}

// IsValidPropertyFieldValueType reports whether the given string is a known value type.
func IsValidPropertyFieldValueType(v string) bool {
	switch v {
	case PropertyFieldValueTypeEmail,
		PropertyFieldValueTypeURL,
		PropertyFieldValueTypePhone:
		return true
	default:
		return false
	}
}

// ValidatePropertyFieldVisibility checks that the visibility attr on a
// PropertyField is either empty or one of hidden/when_set/always.
func ValidatePropertyFieldVisibility(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[PropertyFieldAttrVisibility]
	if !ok {
		return nil
	}

	v, ok := raw.(string)
	if !ok {
		return fmt.Errorf("visibility must be a string")
	}

	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}

	if !IsValidPropertyFieldVisibility(v) {
		return fmt.Errorf("invalid visibility %q: must be one of hidden, when_set, always", v)
	}

	return nil
}

// ValidatePropertyFieldSortOrder checks that the sort_order attr on a
// PropertyField is numeric (float64 or json.Number) or absent.
func ValidatePropertyFieldSortOrder(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[PropertyFieldAttrSortOrder]
	if !ok {
		return nil
	}

	switch raw.(type) {
	case float64, json.Number, int, int64:
		return nil
	default:
		return fmt.Errorf("sort_order must be numeric, got %T", raw)
	}
}

// ValidatePropertyValueForValueType validates a raw JSON value against the
// given value type constraint. This is called for text fields that have a
// value_type attr (email, url, phone).
func ValidatePropertyValueForValueType(valueType string, value json.RawMessage) error {
	if valueType == "" {
		return nil
	}

	var str string
	if err := json.Unmarshal(value, &str); err != nil {
		return fmt.Errorf("expected string value for value_type %q: %w", valueType, err)
	}

	str = strings.TrimSpace(str)
	if str == "" {
		return nil
	}

	switch valueType {
	case PropertyFieldValueTypeEmail:
		if !IsValidEmail(str) {
			return fmt.Errorf("invalid email: %q", str)
		}
	case PropertyFieldValueTypeURL:
		// ParseRequestURI rejects relative references (url.Parse accepts them),
		// and we additionally require a non-empty Host so bare schemes like
		// "http:" or "file:///..." without an authority are rejected.
		u, err := url.ParseRequestURI(str)
		if err != nil {
			return fmt.Errorf("invalid url: %w", err)
		}
		if u.Scheme == "" || u.Host == "" {
			return fmt.Errorf("invalid url: %q", str)
		}
	case PropertyFieldValueTypePhone:
		// Phone values are accepted as-is; no structural validation.
	default:
		return fmt.Errorf("unknown value_type %q", valueType)
	}

	return nil
}

// GetPropertyFieldValueType extracts the value_type string from a
// PropertyField's attrs. Returns empty string if not set.
func GetPropertyFieldValueType(field *PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	v, _ := field.Attrs[PropertyFieldAttrValueType].(string)
	return strings.TrimSpace(v)
}

// IsPropertyFieldSynced reports whether the field has an ldap or saml attr set,
// meaning its values are managed by an external sync service.
func IsPropertyFieldSynced(field *PropertyField) bool {
	if field.Attrs == nil {
		return false
	}
	ldap, _ := field.Attrs[PropertyFieldAttrLDAP].(string)
	saml, _ := field.Attrs[PropertyFieldAttrSAML].(string)
	return ldap != "" || saml != ""
}

// GetPropertyFieldSyncSource returns the sync source for a field: "ldap",
// "saml", or empty string if not synced. If both are set, ldap takes priority.
func GetPropertyFieldSyncSource(field *PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	if ldap, _ := field.Attrs[PropertyFieldAttrLDAP].(string); ldap != "" {
		return "ldap"
	}
	if saml, _ := field.Attrs[PropertyFieldAttrSAML].(string); saml != "" {
		return "saml"
	}
	return ""
}
