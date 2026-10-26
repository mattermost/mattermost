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
	t.Run("nil permissions returns public regardless of attrs", func(t *testing.T) {
		f := &PropertyField{Attrs: nil}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())

		f = &PropertyField{Attrs: StringInterface{}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())

		f = &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: 123}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())

		f = &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())

		f = &PropertyField{Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSourceOnly}}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())
	})

	// Non-nil Permissions ignores Attrs entirely -- it is the field's own
	// state once the backfill has converted it.
	t.Run("masking present reports shared_only regardless of tiers", func(t *testing.T) {
		f := &PropertyField{
			Attrs: StringInterface{PropertyAttrsAccessMode: PropertyAccessModePublic},
			Permissions: &Permissions{
				Restrictions: &Restrictions{
					Value:  ReadWrite{Read: PermissionLevelEveryone},
					Option: ReadWrite{Read: PermissionLevelEveryone},
				},
				Masking: &Masking{},
			},
		}
		require.Equal(t, PropertyAccessModeSharedOnly, f.GetAccessMode())
	})
	t.Run("no masking, value.read none reports source_only", func(t *testing.T) {
		f := &PropertyField{
			Permissions: &Permissions{
				Restrictions: &Restrictions{
					Option: ReadWrite{Read: PermissionLevelEveryone},
				},
			},
		}
		require.Equal(t, PropertyAccessModeSourceOnly, f.GetAccessMode())
	})
	t.Run("no masking, option.read none reports source_only", func(t *testing.T) {
		f := &PropertyField{
			Permissions: &Permissions{
				Restrictions: &Restrictions{
					Value: ReadWrite{Read: PermissionLevelEveryone},
				},
			},
		}
		require.Equal(t, PropertyAccessModeSourceOnly, f.GetAccessMode())
	})
	t.Run("no masking, nil restrictions reports source_only", func(t *testing.T) {
		f := &PropertyField{Permissions: &Permissions{}}
		require.Equal(t, PropertyAccessModeSourceOnly, f.GetAccessMode())
	})
	t.Run("no masking, both read tiers set reports public", func(t *testing.T) {
		f := &PropertyField{
			Permissions: &Permissions{
				Restrictions: &Restrictions{
					Value:  ReadWrite{Read: PermissionLevelEveryone},
					Option: ReadWrite{Read: PermissionLevelEveryone},
				},
			},
		}
		require.Equal(t, PropertyAccessModePublic, f.GetAccessMode())
	})
}

func TestEffectiveAccessMode(t *testing.T) {
	public := &Restrictions{
		Value:  ReadWrite{Read: PermissionLevelEveryone},
		Option: ReadWrite{Read: PermissionLevelEveryone},
	}
	template := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: public, Masking: &Masking{}}}
	linked := &PropertyField{LinkedFieldID: &template.ID, Permissions: &Permissions{Restrictions: public}}

	t.Run("a linked field with no masking of its own follows its template", func(t *testing.T) {
		assert.Equal(t, PropertyAccessModeSharedOnly, EffectiveAccessMode(linked, template))
	})
	t.Run("a nil template reports the field's own mode", func(t *testing.T) {
		assert.Equal(t, PropertyAccessModePublic, EffectiveAccessMode(linked, nil))
	})
	t.Run("an unlinked field reports its own mode", func(t *testing.T) {
		unlinked := &PropertyField{Permissions: &Permissions{Restrictions: public}}
		assert.Equal(t, PropertyAccessModePublic, EffectiveAccessMode(unlinked, template))
	})
	t.Run("nil permissions reports the field's own mode", func(t *testing.T) {
		unconverted := &PropertyField{LinkedFieldID: &template.ID}
		assert.Equal(t, PropertyAccessModePublic, EffectiveAccessMode(unconverted, template))
	})
	t.Run("a field's own masking wins over its template", func(t *testing.T) {
		sourceOnly := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: &Restrictions{}}}
		masked := &PropertyField{LinkedFieldID: &sourceOnly.ID, Permissions: &Permissions{Restrictions: public, Masking: &Masking{}}}
		assert.Equal(t, PropertyAccessModeSharedOnly, EffectiveAccessMode(masked, sourceOnly))
	})
}

func TestPropertyFieldReadableByEveryone(t *testing.T) {
	readable := &Restrictions{
		Value:  ReadWrite{Read: PermissionLevelEveryone},
		Option: ReadWrite{Read: PermissionLevelEveryone},
	}
	unmaskedTemplate := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: readable}}
	maskedTemplate := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: readable, Masking: &Masking{}}}
	linkedTo := func(template *PropertyField) *PropertyField {
		return &PropertyField{LinkedFieldID: &template.ID, Permissions: &Permissions{Restrictions: readable}}
	}

	t.Run("everyone on both tiers with no masking is readable by everyone", func(t *testing.T) {
		field := &PropertyField{Permissions: &Permissions{Restrictions: readable}}
		assert.True(t, PropertyFieldReadableByEveryone(field, nil, PropertyActionValueRead))
		assert.True(t, PropertyFieldReadableByEveryone(field, nil, PropertyActionOptionRead))
	})

	t.Run("each tier below everyone is not readable by everyone", func(t *testing.T) {
		for _, tier := range []PermissionLevel{PermissionLevelMember, PermissionLevelCreator, PermissionLevelAdmin, PermissionLevelSysadmin, PermissionLevelNone, ""} {
			valueField := &PropertyField{Permissions: &Permissions{Restrictions: &Restrictions{
				Value:  ReadWrite{Read: tier},
				Option: ReadWrite{Read: PermissionLevelEveryone},
			}}}
			assert.False(t, PropertyFieldReadableByEveryone(valueField, nil, PropertyActionValueRead), "value.read %q", tier)
			assert.True(t, PropertyFieldReadableByEveryone(valueField, nil, PropertyActionOptionRead), "option.read is judged on its own tier")

			optionField := &PropertyField{Permissions: &Permissions{Restrictions: &Restrictions{
				Value:  ReadWrite{Read: PermissionLevelEveryone},
				Option: ReadWrite{Read: tier},
			}}}
			assert.False(t, PropertyFieldReadableByEveryone(optionField, nil, PropertyActionOptionRead), "option.read %q", tier)
			assert.True(t, PropertyFieldReadableByEveryone(optionField, nil, PropertyActionValueRead), "value.read is judged on its own tier")
		}
	})

	t.Run("a field's own masking is not readable by everyone", func(t *testing.T) {
		field := &PropertyField{Permissions: &Permissions{Restrictions: readable, Masking: &Masking{}}}
		assert.False(t, PropertyFieldReadableByEveryone(field, nil, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(field, nil, PropertyActionOptionRead))
	})

	t.Run("no permissions object is not readable by everyone", func(t *testing.T) {
		assert.False(t, PropertyFieldReadableByEveryone(&PropertyField{}, nil, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(&PropertyField{Permissions: &Permissions{}}, nil, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(nil, nil, PropertyActionValueRead))
	})

	t.Run("an action other than a read is not readable by everyone", func(t *testing.T) {
		field := &PropertyField{Permissions: &Permissions{Restrictions: &Restrictions{
			Value: ReadWrite{Read: PermissionLevelEveryone, Write: PermissionLevelEveryone},
		}}}
		assert.False(t, PropertyFieldReadableByEveryone(field, nil, PropertyActionValueWrite))
	})

	t.Run("a linked field follows its template's masking", func(t *testing.T) {
		assert.True(t, PropertyFieldReadableByEveryone(linkedTo(unmaskedTemplate), unmaskedTemplate, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(maskedTemplate), maskedTemplate, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(maskedTemplate), maskedTemplate, PropertyActionOptionRead))
	})

	t.Run("a linked field is judged on its own tier", func(t *testing.T) {
		field := linkedTo(unmaskedTemplate)
		field.Permissions.Restrictions = &Restrictions{
			Value:  ReadWrite{Read: PermissionLevelSysadmin},
			Option: ReadWrite{Read: PermissionLevelEveryone},
		}
		assert.False(t, PropertyFieldReadableByEveryone(field, unmaskedTemplate, PropertyActionValueRead))
	})

	t.Run("a linked field without its template fails closed", func(t *testing.T) {
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(unmaskedTemplate), nil, PropertyActionValueRead))
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(unmaskedTemplate), nil, PropertyActionOptionRead))
	})

	t.Run("a linked field whose template has no permissions object fails closed", func(t *testing.T) {
		unconverted := &PropertyField{ID: NewId()}
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(unconverted), unconverted, PropertyActionValueRead))
	})

	t.Run("a template other than the linked one fails closed", func(t *testing.T) {
		assert.False(t, PropertyFieldReadableByEveryone(linkedTo(maskedTemplate), unmaskedTemplate, PropertyActionValueRead))
	})

	t.Run("an unlinked field ignores a template", func(t *testing.T) {
		field := &PropertyField{Permissions: &Permissions{Restrictions: readable}}
		assert.True(t, PropertyFieldReadableByEveryone(field, maskedTemplate, PropertyActionValueRead))
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
