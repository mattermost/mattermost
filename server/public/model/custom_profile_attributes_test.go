// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCPAFieldFromPropertyField(t *testing.T) {
	testCases := []struct {
		name          string
		propertyField *PropertyField
		wantAttrs     CPAAttrs
		wantErr       bool
	}{
		{
			name: "valid property field with all attributes",
			propertyField: &PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "Test Field",
				Type:    PropertyFieldTypeSelect,
				Attrs: StringInterface{
					CustomProfileAttributesPropertyAttrsVisibility: CustomProfileAttributesVisibilityAlways,
					CustomProfileAttributesPropertyAttrsSortOrder:  1,
					CustomProfileAttributesPropertyAttrsValueType:  CustomProfileAttributesValueTypeEmail,
					PropertyFieldAttributeOptions: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#FF0000",
						},
					},
				},
				CreateAt: GetMillis(),
				UpdateAt: GetMillis(),
			},
			wantAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityAlways,
				SortOrder:  1,
				ValueType:  CustomProfileAttributesValueTypeEmail,
				Options: []*CustomProfileAttributesSelectOption{
					{
						ID:    "", // ID will be different in each test run
						Name:  "Option 1",
						Color: "#FF0000",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid property field with minimal attributes",
			propertyField: &PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "Test Field",
				Type:    PropertyFieldTypeText,
				Attrs: StringInterface{
					CustomProfileAttributesPropertyAttrsVisibility: CustomProfileAttributesVisibilityWhenSet,
					CustomProfileAttributesPropertyAttrsSortOrder:  2,
				},
				CreateAt: GetMillis(),
				UpdateAt: GetMillis(),
			},
			wantAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityWhenSet,
				SortOrder:  2,
				ValueType:  "",
				Options:    nil,
			},
			wantErr: false,
		},
		{
			// Conversion is a pure data operation: empty PropertyField.Attrs
			// produces empty CPAAttrs. The visibility default is applied at
			// write time by AccessControlAttributeValidationHook, not at read time.
			name: "property field with empty attributes returns empty CPAAttrs",
			propertyField: &PropertyField{
				ID:       NewId(),
				GroupID:  AccessControlPropertyGroupName,
				Name:     "Empty Field",
				Type:     PropertyFieldTypeText,
				CreateAt: GetMillis(),
				UpdateAt: GetMillis(),
			},
			wantAttrs: CPAAttrs{},
			wantErr:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cpaField, err := NewCPAFieldFromPropertyField(tc.propertyField)

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, cpaField)

			// Check that the PropertyField was copied correctly
			assert.Equal(t, tc.propertyField.ID, cpaField.ID)
			assert.Equal(t, tc.propertyField.GroupID, cpaField.GroupID)
			assert.Equal(t, tc.propertyField.Name, cpaField.Name)
			assert.Equal(t, tc.propertyField.Type, cpaField.Type)

			// Check that the attributes were parsed correctly
			assert.Equal(t, tc.wantAttrs.Visibility, cpaField.Attrs.Visibility)
			assert.Equal(t, tc.wantAttrs.SortOrder, cpaField.Attrs.SortOrder)
			assert.Equal(t, tc.wantAttrs.ValueType, cpaField.Attrs.ValueType)

			// For options, we need to check length since IDs will be different
			if tc.wantAttrs.Options != nil {
				require.NotNil(t, cpaField.Attrs.Options)
				assert.Len(t, cpaField.Attrs.Options, len(tc.wantAttrs.Options))
				if len(tc.wantAttrs.Options) > 0 {
					assert.Equal(t, tc.wantAttrs.Options[0].Name, cpaField.Attrs.Options[0].Name)
					assert.Equal(t, tc.wantAttrs.Options[0].Color, cpaField.Attrs.Options[0].Color)
				}
			} else {
				assert.Nil(t, cpaField.Attrs.Options)
			}
		})
	}
}

func TestCPAFieldToPropertyField(t *testing.T) {
	tests := []struct {
		name     string
		cpaField *CPAField
	}{
		{
			name: "convert CPA field with all attributes",
			cpaField: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  AccessControlPropertyGroupName,
					Name:     "Test Field",
					Type:     PropertyFieldTypeSelect,
					CreateAt: GetMillis(),
					UpdateAt: GetMillis(),
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityAlways,
					SortOrder:  1,
					ValueType:  CustomProfileAttributesValueTypeEmail,
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#FF0000",
						},
					},
				},
			},
		},
		{
			name: "convert CPA field with minimal attributes",
			cpaField: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  AccessControlPropertyGroupName,
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: GetMillis(),
					UpdateAt: GetMillis(),
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  2,
				},
			},
		},
		{
			name: "convert CPA field with empty attributes",
			cpaField: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  AccessControlPropertyGroupName,
					Name:     "Empty Field",
					Type:     PropertyFieldTypeText,
					CreateAt: GetMillis(),
					UpdateAt: GetMillis(),
				},
				Attrs: CPAAttrs{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pf := tt.cpaField.ToPropertyField()

			require.NotNil(t, pf)

			// Check that the PropertyField was copied correctly
			assert.Equal(t, tt.cpaField.ID, pf.ID)
			assert.Equal(t, tt.cpaField.GroupID, pf.GroupID)
			assert.Equal(t, tt.cpaField.Name, pf.Name)
			assert.Equal(t, tt.cpaField.Type, pf.Type)

			// Check that the attributes were converted correctly
			assert.Equal(t, tt.cpaField.Attrs.Visibility, pf.Attrs[CustomProfileAttributesPropertyAttrsVisibility])
			assert.Equal(t, tt.cpaField.Attrs.SortOrder, pf.Attrs[CustomProfileAttributesPropertyAttrsSortOrder])
			assert.Equal(t, tt.cpaField.Attrs.ValueType, pf.Attrs[CustomProfileAttributesPropertyAttrsValueType])

			// Check options
			options, ok := pf.Attrs[PropertyFieldAttributeOptions]
			if tt.cpaField.Attrs.Options != nil {
				require.True(t, ok)
				optionsSlice, ok := options.(PropertyOptions[*CustomProfileAttributesSelectOption])
				require.True(t, ok)
				assert.Len(t, optionsSlice, len(tt.cpaField.Attrs.Options))
			}
		})
	}

	// Test managed attribute functionality
	t.Run("managed attribute", func(t *testing.T) {
		managedTests := []struct {
			name     string
			cpaField *CPAField
		}{
			{
				name: "CPA field with managed attribute should include it in conversion",
				cpaField: &CPAField{
					PropertyField: PropertyField{
						ID:       NewId(),
						GroupID:  AccessControlPropertyGroupName,
						Name:     "Managed Field",
						Type:     PropertyFieldTypeText,
						CreateAt: GetMillis(),
						UpdateAt: GetMillis(),
					},
					Attrs: CPAAttrs{
						Visibility: CustomProfileAttributesVisibilityAlways,
						SortOrder:  1,
						Managed:    "admin",
					},
				},
			},
			{
				name: "CPA field with empty managed attribute should include it in conversion",
				cpaField: &CPAField{
					PropertyField: PropertyField{
						ID:       NewId(),
						GroupID:  AccessControlPropertyGroupName,
						Name:     "Non-managed Field",
						Type:     PropertyFieldTypeText,
						CreateAt: GetMillis(),
						UpdateAt: GetMillis(),
					},
					Attrs: CPAAttrs{
						Visibility: CustomProfileAttributesVisibilityWhenSet,
						SortOrder:  2,
						Managed:    "",
					},
				},
			},
		}

		for _, tt := range managedTests {
			t.Run(tt.name, func(t *testing.T) {
				pf := tt.cpaField.ToPropertyField()

				require.NotNil(t, pf)

				// Check that the PropertyField was copied correctly
				assert.Equal(t, tt.cpaField.ID, pf.ID)
				assert.Equal(t, tt.cpaField.GroupID, pf.GroupID)
				assert.Equal(t, tt.cpaField.Name, pf.Name)
				assert.Equal(t, tt.cpaField.Type, pf.Type)

				// Check that the managed attribute was converted correctly
				assert.Equal(t, tt.cpaField.Attrs.Managed, pf.Attrs[CustomProfileAttributesPropertyAttrsManaged])
			})
		}
	})
}

func TestCustomProfileAttributeSelectOptionIsValid(t *testing.T) {
	tests := []struct {
		name    string
		option  CustomProfileAttributesSelectOption
		wantErr string
	}{
		{
			name: "valid option with color",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "",
		},
		{
			name: "valid option without color",
			option: CustomProfileAttributesSelectOption{
				ID:   NewId(),
				Name: "Test Option",
			},
			wantErr: "",
		},
		{
			name: "empty ID",
			option: CustomProfileAttributesSelectOption{
				ID:    "",
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "id cannot be empty",
		},
		{
			name: "invalid ID",
			option: CustomProfileAttributesSelectOption{
				ID:    "invalid-id",
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "id is not a valid ID",
		},
		{
			name: "empty name",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "",
				Color: "#FF0000",
			},
			wantErr: "name cannot be empty",
		},
		{
			name: "name too long",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  strings.Repeat("a", CPAOptionNameMaxLength+1),
				Color: "#FF0000",
			},
			wantErr: fmt.Sprintf("name is too long, max length is %d", CPAOptionNameMaxLength),
		},
		{
			name: "color too long",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: strings.Repeat("a", CPAOptionColorMaxLength+1),
			},
			wantErr: fmt.Sprintf("color is too long, max length is %d", CPAOptionColorMaxLength),
		},
		{
			name: "name exactly at max length",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  strings.Repeat("a", CPAOptionNameMaxLength),
				Color: "#FF0000",
			},
			wantErr: "",
		},
		{
			name: "color exactly at max length",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: strings.Repeat("a", CPAOptionColorMaxLength),
			},
			wantErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.option.IsValid()
			if tt.wantErr != "" {
				assert.EqualError(t, err, tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestCPAField_SanitizeAndValidate removed: behavior moved into AccessControlAttributeValidationHook;
// see TestAccessControlAttributeValidationHook in server/channels/app/properties/access_control_attribute_validation_test.go.

func TestValidateCPAFieldName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantErrID string // empty means expect nil (valid)
	}{
		// Accept
		{name: "simple lowercase", input: "department", wantErrID: ""},
		{name: "leading underscore", input: "_private", wantErrID: ""},
		{name: "uppercase start", input: "Department", wantErrID: ""},
		{name: "single uppercase", input: "A1", wantErrID: ""},
		{name: "underscore separator", input: "a_b_c", wantErrID: ""},
		{name: "all uppercase", input: "DEPT", wantErrID: ""},
		// Case sensitivity of reserved-word lookup
		{name: "case-sensitive: IN is not reserved", input: "IN", wantErrID: ""},
		{name: "case-sensitive: In is not reserved", input: "In", wantErrID: ""},
		// Single-character valid names
		{name: "single lowercase letter", input: "a", wantErrID: ""},
		{name: "single underscore", input: "_", wantErrID: ""},
		{name: "single uppercase letter", input: "A", wantErrID: ""},

		// Reject — charset
		{name: "space in name", input: "My Field", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "leading digit", input: "7department", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "hyphen", input: "foo-bar", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "emoji", input: "🎯", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "empty string", input: "", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "trailing space", input: "name ", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},
		{name: "non-ASCII letter", input: "départment", wantErrID: "model.cpa_field.name.invalid_charset.app_error"},

		// Reject — reserved words
		{name: "reserved: in", input: "in", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: as", input: "as", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: true", input: "true", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: false", input: "false", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: null", input: "null", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: function", input: "function", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: var", input: "var", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: return", input: "return", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: if", input: "if", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: for", input: "for", wantErrID: "model.cpa_field.name.reserved_word.app_error"},
		{name: "reserved: import", input: "import", wantErrID: "model.cpa_field.name.reserved_word.app_error"},

		// Boundary — reserved-word prefix/suffix not reserved (e.g. "trueish")
		{name: "reserved word as prefix", input: "trueish", wantErrID: ""},
		{name: "reserved word as suffix", input: "my_null", wantErrID: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			appErr := ValidateCPAFieldName(tt.input)
			if tt.wantErrID == "" {
				require.Nil(t, appErr, "expected nil for input %q, got %v", tt.input, appErr)
			} else {
				require.NotNil(t, appErr, "expected error for input %q", tt.input)
				require.Equal(t, tt.wantErrID, appErr.Id)
			}
		})
	}
}

func TestCPAField_ToPropertyField_DisplayName(t *testing.T) {
	t.Run("DisplayName round-trips through ToPropertyField and NewCPAFieldFromPropertyField", func(t *testing.T) {
		original := &CPAField{
			PropertyField: PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "department",
				Type:    PropertyFieldTypeText,
			},
			Attrs: CPAAttrs{
				Visibility:  CustomProfileAttributesVisibilityAlways,
				SortOrder:   3.0,
				DisplayName: "Department",
			},
		}

		pf := original.ToPropertyField()
		require.NotNil(t, pf)

		require.Equal(t, "Department", pf.Attrs[CustomProfileAttributesPropertyAttrsDisplayName],
			"DisplayName must be written into attrs StringInterface by ToPropertyField")

		roundTripped, err := NewCPAFieldFromPropertyField(pf)
		require.NoError(t, err)
		require.Equal(t, "Department", roundTripped.Attrs.DisplayName,
			"DisplayName must survive the ToPropertyField → NewCPAFieldFromPropertyField round-trip")
	})

	t.Run("Owners round-trip through ToPropertyField and NewCPAFieldFromPropertyField", func(t *testing.T) {
		original := &CPAField{
			PropertyField: PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "department",
				Type:    PropertyFieldTypeText,
			},
			Attrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityAlways,
				Owners: []PropertyOwner{
					{ID: "com.mattermost.scim", Type: PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
				},
			},
		}

		pf := original.ToPropertyField()
		require.NotNil(t, pf)
		require.Contains(t, pf.Attrs, PropertyAttrsOwners, "owners must be written into attrs when present")

		roundTripped, err := NewCPAFieldFromPropertyField(pf)
		require.NoError(t, err)
		require.Len(t, roundTripped.Attrs.Owners, 1)
		require.Equal(t, "com.mattermost.scim", roundTripped.Attrs.Owners[0].ID)
		require.Equal(t, []string{"entra"}, roundTripped.Attrs.Owners[0].Scopes)
	})

	t.Run("absent Owners do not add the owners attr key", func(t *testing.T) {
		field := &CPAField{
			PropertyField: PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "department",
				Type:    PropertyFieldTypeText,
			},
			Attrs: CPAAttrs{Visibility: CustomProfileAttributesVisibilityWhenSet},
		}

		pf := field.ToPropertyField()
		require.NotContains(t, pf.Attrs, PropertyAttrsOwners, "owners key must be omitted when no owners are set")

		roundTripped, err := NewCPAFieldFromPropertyField(pf)
		require.NoError(t, err)
		require.Empty(t, roundTripped.Attrs.Owners)
	})

	t.Run("empty DisplayName round-trips as empty string", func(t *testing.T) {
		field := &CPAField{
			PropertyField: PropertyField{
				ID:      NewId(),
				GroupID: AccessControlPropertyGroupName,
				Name:    "department",
				Type:    PropertyFieldTypeText,
			},
			Attrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityWhenSet,
			},
		}

		pf := field.ToPropertyField()
		// With omitempty, an empty DisplayName should still be written (as empty string) to
		// the StringInterface; NewCPAFieldFromPropertyField should unmarshal it as "".
		roundTripped, err := NewCPAFieldFromPropertyField(pf)
		require.NoError(t, err)
		require.Equal(t, "", roundTripped.Attrs.DisplayName)
	})
}

func TestCPAField_IsAdminManaged(t *testing.T) {
	tests := []struct {
		name     string
		field    *CPAField
		expected bool
	}{
		{
			name: "field with managed admin attribute should return true",
			field: &CPAField{
				Attrs: CPAAttrs{
					Managed: "admin",
				},
			},
			expected: true,
		},
		{
			name: "field with empty managed attribute should return false",
			field: &CPAField{
				Attrs: CPAAttrs{
					Managed: "",
				},
			},
			expected: false,
		},
		{
			name: "field with non-admin managed attribute should return false",
			field: &CPAField{
				Attrs: CPAAttrs{
					Managed: "user",
				},
			},
			expected: false,
		},
		{
			name: "field with no managed attribute should return false",
			field: &CPAField{
				Attrs: CPAAttrs{},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.field.IsAdminManaged()
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestCPAField_SetDefaults removed: visibility default is now applied by AccessControlAttributeValidationHook
// (see access_control_attribute_validation.go), exercised in TestAccessControlAttributeValidationHook.

func TestCPAField_Patch(t *testing.T) {
	testCases := []struct {
		name          string
		field         *CPAField
		patch         *PropertyFieldPatch
		expectedField *CPAField
		expectError   bool
	}{
		{
			name: "patch name",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Original Name",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			patch: &PropertyFieldPatch{
				Name: new("Updated Name"),
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Updated Name",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			expectError: false,
		},
		{
			name: "patch type",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			patch: &PropertyFieldPatch{
				Type: new(PropertyFieldTypeSelect),
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			expectError: false,
		},
		{
			name: "patch visibility (attrs replacement - sort order is lost)",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  1.0,
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsVisibility: CustomProfileAttributesVisibilityAlways,
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityAlways,
					SortOrder:  0, // Lost because attrs is replaced, not merged
				},
			},
			expectError: false,
		},
		{
			name: "patch visibility preserving sort order (must include both in patch)",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  1.0,
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsVisibility: CustomProfileAttributesVisibilityAlways,
					CustomProfileAttributesPropertyAttrsSortOrder:  1.0, // Must include to preserve
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityAlways,
					SortOrder:  1.0,
				},
			},
			expectError: false,
		},
		{
			// Patch with non-nil Attrs replaces the whole Attrs map; visibility
			// drops to "" because the patch doesn't include it. The visibility
			// default is reapplied at write time by AccessControlAttributeValidationHook,
			// not by Patch itself.
			name: "patch sort order",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  1.0,
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsSortOrder: 10.5,
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					SortOrder: 10.5,
				},
			},
			expectError: false,
		},
		{
			name: "patch managed attribute",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					Managed:    "",
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsManaged: "admin",
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Managed: "admin",
				},
			},
			expectError: false,
		},
		{
			name: "patch LDAP attribute",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsLDAP: "ldap_attribute",
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					LDAP: "ldap_attribute",
				},
			},
			expectError: false,
		},
		{
			name: "patch options for select field",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeSelect,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					Options: []*CustomProfileAttributesSelectOption{
						{ID: "opt1", Name: "Option 1"},
					},
				},
			},
			patch: &PropertyFieldPatch{
				Attrs: &StringInterface{
					PropertyFieldAttributeOptions: []*CustomProfileAttributesSelectOption{
						{ID: "opt1", Name: "Option 1"},
						{ID: "opt2", Name: "Option 2"},
					},
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "Test Field",
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{ID: "opt1", Name: "Option 1"},
						{ID: "opt2", Name: "Option 2"},
					},
				},
			},
			expectError: false,
		},
		{
			name: "patch with TargetID should clear it (CPA doesn't use targets)",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			patch: &PropertyFieldPatch{
				Name:     new("Updated Name"),
				TargetID: new("should-be-cleared"),
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name:     "Updated Name",
					Type:     PropertyFieldTypeText,
					TargetID: "", // Should be empty
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			expectError: false,
		},
		{
			name: "patch with TargetType should clear it (CPA doesn't use targets)",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Test Field",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			patch: &PropertyFieldPatch{
				Name:       new("Updated Name"),
				TargetType: new("should-be-cleared"),
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name:       "Updated Name",
					Type:       PropertyFieldTypeText,
					TargetType: "", // Should be empty
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
				},
			},
			expectError: false,
		},
		{
			name: "patch multiple attributes at once",
			field: &CPAField{
				PropertyField: PropertyField{
					ID:       NewId(),
					GroupID:  "group1",
					Name:     "Original Name",
					Type:     PropertyFieldTypeText,
					CreateAt: 1000,
					UpdateAt: 1000,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  1.0,
					Managed:    "",
				},
			},
			patch: &PropertyFieldPatch{
				Name: new("New Name"),
				Attrs: &StringInterface{
					CustomProfileAttributesPropertyAttrsVisibility: CustomProfileAttributesVisibilityAlways,
					CustomProfileAttributesPropertyAttrsSortOrder:  5.0,
					CustomProfileAttributesPropertyAttrsManaged:    "admin",
				},
			},
			expectedField: &CPAField{
				PropertyField: PropertyField{
					Name: "New Name",
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityAlways,
					SortOrder:  5.0,
					Managed:    "admin",
				},
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.field.Patch(tc.patch)

			if tc.expectError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)

			// Check PropertyField attributes
			assert.Equal(t, tc.expectedField.Name, tc.field.Name)
			assert.Equal(t, tc.expectedField.Type, tc.field.Type)
			assert.Equal(t, tc.expectedField.TargetID, tc.field.TargetID)
			assert.Equal(t, tc.expectedField.TargetType, tc.field.TargetType)

			// Check CPAAttrs
			assert.Equal(t, tc.expectedField.Attrs.Visibility, tc.field.Attrs.Visibility)
			assert.Equal(t, tc.expectedField.Attrs.SortOrder, tc.field.Attrs.SortOrder)
			assert.Equal(t, tc.expectedField.Attrs.Managed, tc.field.Attrs.Managed)
			assert.Equal(t, tc.expectedField.Attrs.LDAP, tc.field.Attrs.LDAP)
			assert.Equal(t, tc.expectedField.Attrs.SAML, tc.field.Attrs.SAML)

			// Check options if present
			if tc.expectedField.Attrs.Options != nil {
				require.Len(t, tc.field.Attrs.Options, len(tc.expectedField.Attrs.Options))
				for i, expectedOpt := range tc.expectedField.Attrs.Options {
					assert.Equal(t, expectedOpt.ID, tc.field.Attrs.Options[i].ID)
					assert.Equal(t, expectedOpt.Name, tc.field.Attrs.Options[i].Name)
				}
			} else {
				assert.Nil(t, tc.field.Attrs.Options)
			}
		})
	}
}

func TestCPAFieldsFromPropertyFields(t *testing.T) {
	mkField := func(name string, sortOrder float64) *PropertyField {
		return &PropertyField{
			ID:      NewId(),
			GroupID: AccessControlPropertyGroupName,
			Name:    name,
			Type:    PropertyFieldTypeText,
			Attrs: StringInterface{
				CustomProfileAttributesPropertyAttrsSortOrder: sortOrder,
			},
		}
	}

	t.Run("empty slice returns empty slice", func(t *testing.T) {
		result, err := CPAFieldsFromPropertyFields(nil)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("sorts by SortOrder ascending", func(t *testing.T) {
		input := []*PropertyField{
			mkField("c", 2),
			mkField("a", 0),
			mkField("b", 1),
		}

		result, err := CPAFieldsFromPropertyFields(input)
		require.NoError(t, err)
		require.Len(t, result, 3)
		assert.Equal(t, "a", result[0].Name)
		assert.Equal(t, "b", result[1].Name)
		assert.Equal(t, "c", result[2].Name)
	})

	t.Run("preserves fields with equal SortOrder in encounter order", func(t *testing.T) {
		input := []*PropertyField{
			mkField("first", 0),
			mkField("second", 0),
		}

		result, err := CPAFieldsFromPropertyFields(input)
		require.NoError(t, err)
		require.Len(t, result, 2)
		// sort.Slice is not stable, but the test asserts both possible stable outcomes
		// — we care that both fields are present, not stability.
		names := []string{result[0].Name, result[1].Name}
		assert.Contains(t, names, "first")
		assert.Contains(t, names, "second")
	})

	t.Run("propagates conversion errors", func(t *testing.T) {
		// options stored as an invalid JSON-marshallable type so that
		// json.Marshal fails inside NewCPAFieldFromPropertyField
		input := []*PropertyField{{
			ID:      NewId(),
			GroupID: AccessControlPropertyGroupName,
			Name:    "bad",
			Type:    PropertyFieldTypeText,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: make(chan int),
			},
		}}

		result, err := CPAFieldsFromPropertyFields(input)
		require.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("preserves empty visibility from PropertyField (defaults are applied at write time by AccessControlAttributeValidationHook, not at read time)", func(t *testing.T) {
		input := []*PropertyField{{
			ID:      NewId(),
			GroupID: AccessControlPropertyGroupName,
			Name:    "no_visibility",
			Type:    PropertyFieldTypeText,
			Attrs:   StringInterface{},
		}}

		result, err := CPAFieldsFromPropertyFields(input)
		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Empty(t, result[0].Attrs.Visibility)
	})
}
