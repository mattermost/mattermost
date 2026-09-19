// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsValidPropertyOwnerType(t *testing.T) {
	for _, ownerType := range []string{
		PropertyOwnerTypePlugin,
		PropertyOwnerTypeService,
		PropertyOwnerTypeRole,
		PropertyOwnerTypeUser,
	} {
		assert.True(t, IsValidPropertyOwnerType(ownerType), ownerType)
	}
	assert.False(t, IsValidPropertyOwnerType(""))
	assert.False(t, IsValidPropertyOwnerType("bogus"))
}

func TestIsValidPropertyOwnerScope(t *testing.T) {
	for _, scope := range []string{
		"entra",
		"Okta",
		"entra:tenant-1",
		"a.b_c-d",
		"ldap",
	} {
		assert.True(t, IsValidPropertyOwnerScope(scope), scope)
	}

	for _, scope := range []string{
		"",
		" spaces",
		"a b",
		"a\nb",
		"🔥",
		"<script>",
	} {
		assert.False(t, IsValidPropertyOwnerScope(scope), scope)
	}
}

func TestGetPropertyFieldOwners(t *testing.T) {
	t.Run("returns nil when no attrs or no owners", func(t *testing.T) {
		assert.Nil(t, GetPropertyFieldOwners(nil))
		assert.Nil(t, GetPropertyFieldOwners(&PropertyField{}))
		assert.False(t, HasPropertyFieldOwners(&PropertyField{}))
	})

	t.Run("reads the typed []PropertyOwner shape", func(t *testing.T) {
		field := &PropertyField{Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{ID: "com.mattermost.scim", Type: PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			},
		}}
		owners := GetPropertyFieldOwners(field)
		require.Len(t, owners, 1)
		assert.Equal(t, "com.mattermost.scim", owners[0].ID)
		assert.True(t, HasPropertyFieldOwners(field))
	})

	t.Run("reads the generic JSON-round-tripped shape", func(t *testing.T) {
		field := &PropertyField{Attrs: StringInterface{
			PropertyAttrsOwners: []any{
				map[string]any{"id": "com.mattermost.scim", "type": "plugin", "scopes": []any{"entra"}},
			},
		}}
		owners := GetPropertyFieldOwners(field)
		require.Len(t, owners, 1)
		assert.Equal(t, "com.mattermost.scim", owners[0].ID)
		assert.Equal(t, PropertyOwnerTypePlugin, owners[0].Type)
		assert.Equal(t, []string{"entra"}, owners[0].Scopes)
	})
}

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

func TestPropertyFieldGetAccessMode(t *testing.T) {
	t.Run("nil attrs returns public", func(t *testing.T) {
		f := &PropertyField{Attrs: nil}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())
	})
	t.Run("missing access_mode returns public", func(t *testing.T) {
		f := &PropertyField{Attrs: StringInterface{}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())
	})
	t.Run("non-string access_mode returns public", func(t *testing.T) {
		f := &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: 123}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())
	})
	t.Run("shared_only returned as-is", func(t *testing.T) {
		f := &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly}}
		require.Equal(t, PropertyAccessModeSharedOnly, f.GetAccessMode())
	})
	t.Run("source_only returned as-is", func(t *testing.T) {
		f := &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSourceOnly}}
		require.Equal(t, PropertyAccessModeSourceOnly, f.GetAccessMode())
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
			name: "valid shared_only access mode with text field and protected",
			field: &PropertyField{
				Type: PropertyFieldTypeText,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "valid shared_only access mode with date field and protected",
			field: &PropertyField{
				Type: PropertyFieldTypeDate,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "valid shared_only access mode with user field and protected",
			field: &PropertyField{
				Type: PropertyFieldTypeUser,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			expectError: false,
		},
		{
			name: "shared_only access mode with text field requires protected",
			field: &PropertyField{
				Type:  PropertyFieldTypeText,
				Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly},
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
			name: "shared_only rejected with member-writable permission_values",
			field: &PropertyField{
				Type: PropertyFieldTypeSelect,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
				PermissionValues: func() *PermissionLevel { p := PermissionLevelMember; return &p }(),
			},
			expectError: true,
		},
		{
			name: "shared_only accepted with sysadmin permission_values",
			field: &PropertyField{
				Type: PropertyFieldTypeSelect,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
				PermissionValues: func() *PermissionLevel { p := PermissionLevelSysadmin; return &p }(),
			},
			expectError: false,
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
