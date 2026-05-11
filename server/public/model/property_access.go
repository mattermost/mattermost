// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
)

const (
	// Property Field Access Control Attributes
	PropertyAttrsProtected      = "protected"
	PropertyAttrsSourcePluginID = "source_plugin_id"
	PropertyAttrsAccessMode     = "access_mode"

	// Access Modes
	PropertyAccessModePublic     = "" // Empty string means public (default)
	PropertyAccessModeSourceOnly = "source_only"
	PropertyAccessModeSharedOnly = "shared_only"
)

// IsKnownPropertyAccessMode checks if the given access mode is a recognized value
func IsKnownPropertyAccessMode(accessMode string) bool {
	switch accessMode {
	case PropertyAccessModePublic,
		PropertyAccessModeSourceOnly,
		PropertyAccessModeSharedOnly:
		return true
	}
	return false
}

// IsPropertyFieldProtected returns whether a PropertyField is protected from modifications
// by callers other than the source plugin
func IsPropertyFieldProtected(field *PropertyField) bool {
	if field.Attrs == nil {
		return false
	}

	protected, ok := field.Attrs[PropertyAttrsProtected].(bool)
	return ok && protected
}

// GetAccessMode returns the field's access mode. Returns the public mode (empty
// string) when no access_mode is configured or the field has no attrs at all.
func (f *PropertyField) GetAccessMode() string {
	if f.Attrs == nil {
		return PropertyAccessModePublic
	}
	accessMode, ok := f.Attrs[PropertyAttrsAccessMode].(string)
	if !ok {
		return PropertyAccessModePublic
	}
	return accessMode
}

// ValidatePropertyFieldAccessMode validates that the access_mode attribute is valid
// and compatible with the field type
func ValidatePropertyFieldAccessMode(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	accessMode, ok := field.Attrs[PropertyAttrsAccessMode].(string)
	if !ok {
		// No access mode set, that's fine (defaults to public)
		return nil
	}

	// Check if access mode is known
	if !IsKnownPropertyAccessMode(accessMode) {
		return fmt.Errorf("invalid access mode '%s'", accessMode)
	}

	// Validate that non-public access modes require protected flag
	if accessMode == PropertyAccessModeSourceOnly || accessMode == PropertyAccessModeSharedOnly {
		if !IsPropertyFieldProtected(field) {
			return fmt.Errorf("access mode '%s' requires the field to be protected", accessMode)
		}
	}

	// shared_only + member-writable is contradictory: shared_only filters what
	// callers see to values they hold, but member-writable lets users self-assign
	// any value. Reject the combination at validation time instead of working
	// around it at the API/service layer.
	if accessMode == PropertyAccessModeSharedOnly && field.PermissionValues != nil && *field.PermissionValues == PermissionLevelMember {
		return fmt.Errorf("access mode 'shared_only' is incompatible with member-writable permission_values")
	}

	return nil
}
