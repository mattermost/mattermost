// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/url"
	"slices"
	"strings"
)

// Attribute keys used across property groups. These are the canonical keys
// stored in PropertyField.Attrs and referenced by hooks.
const (
	PropertyFieldAttrVisibility  = "visibility"
	PropertyFieldAttrSortOrder   = "sort_order"
	PropertyFieldAttrValueType   = "value_type"
	PropertyFieldAttrLDAP        = "ldap"
	PropertyFieldAttrSAML        = "saml"
	PropertyFieldAttrManaged     = "managed"
	PropertyFieldAttrDisplayName = "display_name"
	// PropertyFieldAttrActions lists the rendering actions a field triggers.
	PropertyFieldAttrActions = "actions"
	// PropertyFieldAttrRequired marks a field whose value must be supplied when the
	// target resource is created.
	PropertyFieldAttrRequired = "required"
	// PropertyFieldAttrEditable allows a value to change after it is first set.
	// Absent means editable, and must stay indistinguishable from an explicit true
	// so fields predating the key keep their behaviour without a migration.
	PropertyFieldAttrEditable = "editable"
	// PropertyFieldAttrChangePolicy constrains how a value may move once set. It
	// supersedes editable, which can only express change/never-change; the two are
	// written together for "never" so readers predating this key still lock.
	PropertyFieldAttrChangePolicy = "change_policy"
)

// Valid values for PropertyFieldAttrChangePolicy. Raise and lower compare option
// ranks, so they are only meaningful on a rank-typed field.
const (
	PropertyFieldChangePolicyAny       = "any"
	PropertyFieldChangePolicyRaiseOnly = "raise_only"
	PropertyFieldChangePolicyLowerOnly = "lower_only"
	PropertyFieldChangePolicyNever     = "never"
)

var validPropertyFieldChangePolicies = []string{
	PropertyFieldChangePolicyAny,
	PropertyFieldChangePolicyRaiseOnly,
	PropertyFieldChangePolicyLowerOnly,
	PropertyFieldChangePolicyNever,
}

// IsValidPropertyFieldChangePolicy reports whether the given string is a known
// change policy.
func IsValidPropertyFieldChangePolicy(p string) bool {
	return slices.Contains(validPropertyFieldChangePolicies, p)
}

// IsOrderedPropertyFieldChangePolicy reports whether the policy compares option
// ranks, and so requires a rank-typed field.
func IsOrderedPropertyFieldChangePolicy(p string) bool {
	return p == PropertyFieldChangePolicyRaiseOnly || p == PropertyFieldChangePolicyLowerOnly
}

// SanitizeAndValidatePropertyFieldChangePolicy validates the change_policy attr and
// removes it when unset, empty, or "any", so the permissive default has one
// representation rather than two.
func SanitizeAndValidatePropertyFieldChangePolicy(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[PropertyFieldAttrChangePolicy]
	if !ok {
		return nil
	}
	if raw == nil {
		delete(field.Attrs, PropertyFieldAttrChangePolicy)
		return nil
	}

	p, ok := raw.(string)
	if !ok {
		return fmt.Errorf("change_policy must be a string, got %T", raw)
	}

	p = strings.TrimSpace(p)
	if p == "" || p == PropertyFieldChangePolicyAny {
		delete(field.Attrs, PropertyFieldAttrChangePolicy)
		return nil
	}

	if !IsValidPropertyFieldChangePolicy(p) {
		return fmt.Errorf("invalid change_policy %q: must be one of %s", p, strings.Join(validPropertyFieldChangePolicies, ", "))
	}

	// A directional policy compares ranks, so it is stripped off any other type
	// rather than kept — same treatment as ldap/saml on a non-text field, and it
	// keeps a rank->select type change patchable instead of permanently invalid.
	if IsOrderedPropertyFieldChangePolicy(p) && field.Type != PropertyFieldTypeRank {
		delete(field.Attrs, PropertyFieldAttrChangePolicy)
		return nil
	}

	field.Attrs[PropertyFieldAttrChangePolicy] = p

	return nil
}

// GetPropertyFieldChangePolicy returns the field's change policy, defaulting to
// "any". An explicit editable=false with no change_policy reads as "never", so
// fields written before the key keep their behaviour.
func GetPropertyFieldChangePolicy(field *PropertyField) string {
	if field.Attrs == nil {
		return PropertyFieldChangePolicyAny
	}
	if p, _ := field.Attrs[PropertyFieldAttrChangePolicy].(string); p != "" {
		return p
	}
	if editable, ok := field.Attrs[PropertyFieldAttrEditable].(bool); ok && !editable {
		return PropertyFieldChangePolicyNever
	}
	return PropertyFieldChangePolicyAny
}

// IsPropertyFieldRequired reports whether a value must be supplied when the
// target resource is created. Only an explicit boolean true counts: a field
// carrying a stringly "true" is a misconfiguration and must not read as
// required, or a typo silently blocks channel creation.
func IsPropertyFieldRequired(field *PropertyField) bool {
	if field == nil || field.Attrs == nil {
		return false
	}
	required, _ := field.Attrs[PropertyFieldAttrRequired].(bool)
	return required
}

// Valid action values for PropertyFieldAttrActions.
const (
	PropertyFieldActionDisplayBannerTop    = "display_banner_top"
	PropertyFieldActionDisplayBannerBottom = "display_banner_bottom"
	PropertyFieldActionDisplayLabelHeader  = "display_label_header"
	PropertyFieldActionDisplayLabelInfo    = "display_label_info"
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

// validPropertyFieldActions is the allow-list for PropertyFieldAttrActions, and
// the source of the list surfaced in validation errors.
var validPropertyFieldActions = []string{
	PropertyFieldActionDisplayBannerTop,
	PropertyFieldActionDisplayBannerBottom,
	PropertyFieldActionDisplayLabelHeader,
	PropertyFieldActionDisplayLabelInfo,
}

// IsValidPropertyFieldAction reports whether the given string is a known action value.
func IsValidPropertyFieldAction(a string) bool {
	return slices.Contains(validPropertyFieldActions, a)
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

// SanitizeAndValidatePropertyFieldBoolAttr validates a boolean attr and removes it
// when explicitly unset, so absent and cleared read alike. A string such as "true"
// is rejected rather than coerced: a silently-coerced typo would flip whether a
// value is demanded at creation, or whether it can change afterwards.
func SanitizeAndValidatePropertyFieldBoolAttr(field *PropertyField, key string) error {
	if field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[key]
	if !ok {
		return nil
	}

	if raw == nil {
		delete(field.Attrs, key)
		return nil
	}

	v, ok := raw.(bool)
	if !ok {
		return fmt.Errorf("%s must be a boolean, got %T", key, raw)
	}

	field.Attrs[key] = v

	return nil
}

// SanitizeAndValidatePropertyFieldActions validates the actions attr and writes
// it back in the canonical []any form of trimmed strings, so downstream readers
// see a single shape. An absent, nil, or empty list is removed. Unknown actions
// and duplicates are rejected: the values drive rendering, so a typo must fail
// loudly at write time rather than silently never render.
func SanitizeAndValidatePropertyFieldActions(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[PropertyFieldAttrActions]
	if !ok {
		return nil
	}
	if raw == nil {
		delete(field.Attrs, PropertyFieldAttrActions)
		return nil
	}

	// Callers reach this both from JSON ([]any) and from Go code ([]string).
	var items []string
	switch v := raw.(type) {
	case []string:
		items = v
	case []any:
		items = make([]string, 0, len(v))
		for i, elem := range v {
			s, ok := elem.(string)
			if !ok {
				return fmt.Errorf("actions[%d] must be a string, got %T", i, elem)
			}
			items = append(items, s)
		}
	default:
		return fmt.Errorf("actions must be an array, got %T", raw)
	}

	if len(items) == 0 {
		delete(field.Attrs, PropertyFieldAttrActions)
		return nil
	}

	seen := make(map[string]struct{}, len(items))
	canonical := make([]any, 0, len(items))
	for _, s := range items {
		s = strings.TrimSpace(s)
		if s == "" {
			return fmt.Errorf("actions must not contain empty strings")
		}
		if !IsValidPropertyFieldAction(s) {
			return fmt.Errorf("unknown action %q: must be one of %s", s, strings.Join(validPropertyFieldActions, ", "))
		}
		if _, dup := seen[s]; dup {
			return fmt.Errorf("duplicate action %q", s)
		}
		seen[s] = struct{}{}
		canonical = append(canonical, s)
	}

	field.Attrs[PropertyFieldAttrActions] = canonical
	return nil
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
