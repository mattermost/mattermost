// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsKnownPropertyAccessMode(t *testing.T) {
	tests := []struct {
		name       string
		accessMode string
		expected   bool
	}{
		{"empty string (public) is valid", PropertyAccessModePublic, true},
		{"source_only is valid", PropertyAccessModeSourceOnly, true},
		{"shared_only is valid", PropertyAccessModeSharedOnly, true},
		{"unknown mode is invalid", "unknown", false},
		{"random string is invalid", "random_mode", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsKnownPropertyAccessMode(tt.accessMode)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsPropertyFieldProtected(t *testing.T) {
	t.Run("returns true when protected is true", func(t *testing.T) {
		field := &PropertyField{
			ID:      NewId(),
			GroupID: "test_group",
			Name:    "Protected Field",
			Type:    PropertyFieldTypeText,
			Attrs: StringInterface{
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		require.True(t, IsPropertyFieldProtected(field))
	})

	t.Run("returns false when protected is false", func(t *testing.T) {
		field := &PropertyField{
			ID:      NewId(),
			GroupID: "test_group",
			Name:    "Non-Protected Field",
			Type:    PropertyFieldTypeText,
			Attrs: StringInterface{
				PropertyAttrsProtected:      false,
				PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		require.False(t, IsPropertyFieldProtected(field))
	})

	t.Run("returns false when protected is not set", func(t *testing.T) {
		field := &PropertyField{
			ID:      NewId(),
			GroupID: "test_group",
			Name:    "Field Without Protected",
			Type:    PropertyFieldTypeText,
			Attrs: StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		require.False(t, IsPropertyFieldProtected(field))
	})

	t.Run("returns false when attrs is nil", func(t *testing.T) {
		field := &PropertyField{
			ID:      NewId(),
			GroupID: "test_group",
			Name:    "Field Without Attrs",
			Type:    PropertyFieldTypeText,
			Attrs:   nil,
		}

		require.False(t, IsPropertyFieldProtected(field))
	})
}

func TestValidatePropertyFieldAccessMode(t *testing.T) {
	tests := []struct {
		name        string
		field       *PropertyField
		expectError bool
	}{
		{
			name: "valid public (empty string) access mode",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModePublic},
			},
			expectError: false,
		},
		{
			name: "valid source_only access mode with protected",
			field: &PropertyField{
				Type: PropertyFieldTypeText,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSourceOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "source_only access mode requires protected",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSourceOnly},
			},
			expectError: true,
		},
		{
			name: "valid shared_only access mode with select field and protected",
			field: &PropertyField{
				Type: PropertyFieldTypeSelect,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "shared_only access mode with select field requires protected",
			field: &PropertyField{
				Type:  PropertyFieldTypeSelect,
				Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly},
			},
			expectError: true,
		},
		{
			name: "valid shared_only access mode with multiselect field and protected",
			field: &PropertyField{
				Type: PropertyFieldTypeMultiselect,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "shared_only access mode with multiselect field requires protected",
			field: &PropertyField{
				Type:  PropertyFieldTypeMultiselect,
				Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly},
			},
			expectError: true,
		},
		{
			name: "invalid shared_only access mode with text field",
			field: &PropertyField{
				Type: PropertyFieldTypeText,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: true,
		},
		{
			name: "invalid shared_only access mode with date field",
			field: &PropertyField{
				Type: PropertyFieldTypeDate,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: true,
		},
		{
			name: "invalid shared_only access mode with user field",
			field: &PropertyField{
				Type: PropertyFieldTypeUser,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: true,
		},
		{
			name: "unknown access mode",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: StringInterface{PropertyAttrsAccessMode: "unknown_mode"},
			},
			expectError: true,
		},
		{
			name: "nil attrs should not error",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: nil,
			},
			expectError: false,
		},
		{
			name: "missing access_mode should not error",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: StringInterface{},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePropertyFieldAccessMode(tt.field)
			if tt.expectError {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
		})
	}
}
