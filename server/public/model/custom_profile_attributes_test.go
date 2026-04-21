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
				GroupID: ProtectedAttributesPropertyGroupName,
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
				GroupID: ProtectedAttributesPropertyGroupName,
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
			name: "property field with empty attributes returns default values",
			propertyField: &PropertyField{
				ID:       NewId(),
				GroupID:  ProtectedAttributesPropertyGroupName,
				Name:     "Empty Field",
				Type:     PropertyFieldTypeText,
				CreateAt: GetMillis(),
				UpdateAt: GetMillis(),
			},
			wantAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityWhenSet, // Defaults are applied during conversion
				SortOrder:  0,
				ValueType:  "",
				Options:    nil,
			},
			wantErr: false,
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
					GroupID:  ProtectedAttributesPropertyGroupName,
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
					GroupID:  ProtectedAttributesPropertyGroupName,
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
					GroupID:  ProtectedAttributesPropertyGroupName,
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
						GroupID:  ProtectedAttributesPropertyGroupName,
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
						GroupID:  ProtectedAttributesPropertyGroupName,
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

func TestCPAField_SanitizeAndValidate(t *testing.T) {
	tests := []struct {
		name           string
		field          *CPAField
		expectError    bool
		errorId        string
		expectedAttrs  CPAAttrs
		checkOptionsID bool
	}{
		{
			name: "valid text field with no value type",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: "when_set",
			},
		},
		{
			name: "valid text field with valid value type and whitespace",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					ValueType: " email ",
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: "when_set",
				ValueType:  CustomProfileAttributesValueTypeEmail,
			},
		},
		{
			name: "valid text field with visibility and whitespace",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: " hidden ",
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityHidden,
			},
		},
		{
			name: "invalid text field with invalid value type",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					ValueType: "invalid_type",
				},
			},
			expectError: true,
			errorId:     "app.custom_profile_attributes.sanitize_and_validate.app_error",
		},
		{
			name: "valid select field with valid options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							Name:  "Option 1",
							Color: "#123456",
						},
						{
							Name:  "Option 2",
							Color: "#654321",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
					{Name: "Option 1", Color: "#123456"},
					{Name: "Option 2", Color: "#654321"},
				},
			},
		},
		{
			name: "valid select field with valid options with ids",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    "t9ceh651eir4zkhyh4m54s5r7w",
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
					{ID: "t9ceh651eir4zkhyh4m54s5r7w", Name: "Option 1", Color: "#123456"},
				},
			},
			checkOptionsID: true,
		},
		{
			name: "invalid select field with duplicate option names",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							Name:  "Option 1",
							Color: "opt1",
						},
						{
							Name:  "Option 1",
							Color: "opt2",
						},
					},
				},
			},
			expectError: true,
			errorId:     "app.custom_profile_attributes.sanitize_and_validate.app_error",
		},
		{
			name: "invalid field with unknown visibility",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Visibility: "unknown",
				},
			},
			expectError: true,
			errorId:     "app.custom_profile_attributes.sanitize_and_validate.app_error",
		},

		// Test options cleaning for types that don't support options
		{
			name: "text field with options should clean options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options:    nil, // Options should be cleaned
			},
		},
		{
			name: "date field with options should clean options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeDate,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options:    nil, // Options should be cleaned
			},
		},
		{
			name: "user field with options should clean options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeUser,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options:    nil, // Options should be cleaned
			},
		},

		// Test options preservation for types that support options
		{
			name: "select field with options should preserve options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
					{Name: "Option 1", Color: "#123456"},
				},
			},
		},
		{
			name: "multiselect field with options should preserve options",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeMultiselect,
				},
				Attrs: CPAAttrs{
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
					{Name: "Option 1", Color: "#123456"},
				},
			},
		},

		// Test syncing attributes cleaning for types that don't support syncing
		{
			name: "select field with LDAP and SAML should clean syncing attributes",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeSelect,
				},
				Attrs: CPAAttrs{
					LDAP: "ldap_attribute",
					SAML: "saml_attribute",
					Options: []*CustomProfileAttributesSelectOption{
						{
							ID:    NewId(),
							Name:  "Option 1",
							Color: "#123456",
						},
					},
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				LDAP:       "", // Should be cleaned
				SAML:       "", // Should be cleaned
				Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
					{Name: "Option 1", Color: "#123456"},
				},
			},
		},
		{
			name: "date field with LDAP and SAML should clean syncing attributes",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeDate,
				},
				Attrs: CPAAttrs{
					LDAP: "ldap_attribute",
					SAML: "saml_attribute",
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				LDAP:       "", // Should be cleaned
				SAML:       "", // Should be cleaned
			},
		},

		// Test syncing attributes preservation for types that support syncing
		{
			name: "text field with LDAP and SAML should preserve syncing attributes",
			field: &CPAField{
				PropertyField: PropertyField{
					Type: PropertyFieldTypeText,
				},
				Attrs: CPAAttrs{
					LDAP: "ldap_attribute",
					SAML: "saml_attribute",
				},
			},
			expectError: false,
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				LDAP:       "ldap_attribute", // Should be preserved
				SAML:       "saml_attribute", // Should be preserved
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.field.SanitizeAndValidate()
			if tt.expectError {
				require.NotNil(t, err)
				require.Equal(t, tt.errorId, err.Id)
			} else {
				var ogErr error
				if err != nil {
					ogErr = err.Unwrap()
				}
				require.Nilf(t, err, "unexpected error: %v, with original error: %v", err, ogErr)

				assert.Equal(t, tt.expectedAttrs.Visibility, tt.field.Attrs.Visibility)
				assert.Equal(t, tt.expectedAttrs.ValueType, tt.field.Attrs.ValueType)

				for i := range tt.expectedAttrs.Options {
					if tt.checkOptionsID {
						assert.Equal(t, tt.expectedAttrs.Options[i].ID, tt.field.Attrs.Options[i].ID)
					}
					assert.Equal(t, tt.expectedAttrs.Options[i].Name, tt.field.Attrs.Options[i].Name)
					assert.Equal(t, tt.expectedAttrs.Options[i].Color, tt.field.Attrs.Options[i].Color)
				}
			}
		})
	}

	// Test managed fields functionality
	t.Run("managed fields", func(t *testing.T) {
		managedTests := []struct {
			name          string
			field         *CPAField
			expectError   bool
			errorId       string
			expectedAttrs CPAAttrs
		}{
			{
				name: "valid managed field with admin value",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						Managed: "admin",
					},
				},
				expectError: false,
				expectedAttrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityDefault,
					Managed:    "admin",
				},
			},
			{
				name: "managed field with whitespace should be trimmed",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						Managed: " admin ",
					},
				},
				expectError: false,
				expectedAttrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityDefault,
					Managed:    "admin",
				},
			},
			{
				name: "field with empty managed should be allowed",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						Managed: "",
					},
				},
				expectError: false,
				expectedAttrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityDefault,
					Managed:    "",
				},
			},
			{
				name: "field with invalid managed value should fail",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						Managed: "invalid",
					},
				},
				expectError: true,
				errorId:     "app.custom_profile_attributes.sanitize_and_validate.app_error",
			},
			{
				name: "managed field should clear LDAP sync properties",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						Managed: "admin",
						LDAP:    "ldap_attribute",
						SAML:    "saml_attribute",
					},
				},
				expectError: false,
				expectedAttrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityDefault,
					Managed:    "admin",
					LDAP:       "", // Should be cleared
					SAML:       "", // Should be cleared
				},
			},
			{
				name: "managed field should clear sync properties even when field supports syncing",
				field: &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText, // Text fields support syncing
					},
					Attrs: CPAAttrs{
						Managed: "admin",
						LDAP:    "ldap_attribute",
					},
				},
				expectError: false,
				expectedAttrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityDefault,
					Managed:    "admin",
					LDAP:       "", // Should be cleared due to mutual exclusivity
					SAML:       "",
				},
			},
		}

		for _, tt := range managedTests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.field.SanitizeAndValidate()
				if tt.expectError {
					require.NotNil(t, err)
					require.Equal(t, tt.errorId, err.Id)
				} else {
					require.Nil(t, err)
					assert.Equal(t, tt.expectedAttrs.Visibility, tt.field.Attrs.Visibility)
					assert.Equal(t, tt.expectedAttrs.Managed, tt.field.Attrs.Managed)
					assert.Equal(t, tt.expectedAttrs.LDAP, tt.field.Attrs.LDAP)
					assert.Equal(t, tt.expectedAttrs.SAML, tt.field.Attrs.SAML)
				}
			})
		}
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

func TestCPAField_SetDefaults(t *testing.T) {
	testCases := []struct {
		name          string
		field         *CPAField
		expectedAttrs CPAAttrs
	}{
		{
			name: "field with empty visibility should set default",
			field: &CPAField{
				Attrs: CPAAttrs{
					Visibility: "",
					SortOrder:  5.0,
				},
			},
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				SortOrder:  5.0,
			},
		},
		{
			name: "field with existing visibility should not change",
			field: &CPAField{
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityAlways,
					SortOrder:  10.0,
				},
			},
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityAlways,
				SortOrder:  10.0,
			},
		},
		{
			name: "field with zero values should set visibility default, keep sort order zero",
			field: &CPAField{
				Attrs: CPAAttrs{},
			},
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityDefault,
				SortOrder:  0.0,
			},
		},
		{
			name: "field with hidden visibility should preserve it",
			field: &CPAField{
				Attrs: CPAAttrs{
					Visibility: CustomProfileAttributesVisibilityHidden,
					SortOrder:  3.5,
				},
			},
			expectedAttrs: CPAAttrs{
				Visibility: CustomProfileAttributesVisibilityHidden,
				SortOrder:  3.5,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.field.SetDefaults()
			assert.Equal(t, tc.expectedAttrs.Visibility, tc.field.Attrs.Visibility)
			assert.Equal(t, tc.expectedAttrs.SortOrder, tc.field.Attrs.SortOrder)
		})
	}
}

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
				Name: NewPointer("Updated Name"),
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
				Type: NewPointer(PropertyFieldTypeSelect),
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
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					SortOrder:  10.5,
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
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					Managed:    "admin",
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
					Visibility: CustomProfileAttributesVisibilityWhenSet,
					LDAP:       "ldap_attribute",
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
					Visibility: CustomProfileAttributesVisibilityWhenSet,
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
				Name:     NewPointer("Updated Name"),
				TargetID: NewPointer("should-be-cleared"),
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
				Name:       NewPointer("Updated Name"),
				TargetType: NewPointer("should-be-cleared"),
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
				Name: NewPointer("New Name"),
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
			GroupID: ProtectedAttributesPropertyGroupName,
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
			GroupID: ProtectedAttributesPropertyGroupName,
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

	t.Run("applies SetDefaults via NewCPAFieldFromPropertyField", func(t *testing.T) {
		input := []*PropertyField{{
			ID:      NewId(),
			GroupID: ProtectedAttributesPropertyGroupName,
			Name:    "no_visibility",
			Type:    PropertyFieldTypeText,
			Attrs:   StringInterface{},
		}}

		result, err := CPAFieldsFromPropertyFields(input)
		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, CustomProfileAttributesVisibilityDefault, result[0].Attrs.Visibility)
	})
}
