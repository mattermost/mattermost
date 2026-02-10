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

	// Validate shared_only is only used with select/multiselect fields
	if accessMode == PropertyAccessModeSharedOnly {
		if field.Type != PropertyFieldTypeSelect && field.Type != PropertyFieldTypeMultiselect {
			return fmt.Errorf("access mode 'shared_only' can only be used with select or multiselect field types, got '%s'", field.Type)
		}
	}

	// Validate that non-public access modes require protected flag
	if accessMode == PropertyAccessModeSourceOnly || accessMode == PropertyAccessModeSharedOnly {
		if !IsPropertyFieldProtected(field) {
			return fmt.Errorf("access mode '%s' requires the field to be protected", accessMode)
		}
	}

	return nil
}
