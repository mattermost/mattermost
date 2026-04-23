// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
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
				GroupID: CustomProfileAttributesPropertyGroupName,
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
				GroupID: CustomProfileAttributesPropertyGroupName,
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
				GroupID:  CustomProfileAttributesPropertyGroupName,
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
					GroupID:  CustomProfileAttributesPropertyGroupName,
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
					GroupID:  CustomProfileAttributesPropertyGroupName,
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
					GroupID:  CustomProfileAttributesPropertyGroupName,
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
						GroupID:  CustomProfileAttributesPropertyGroupName,
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
						GroupID:  CustomProfileAttributesPropertyGroupName,
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

	t.Run("display_name sanitization", func(t *testing.T) {
		displayNameTests := []struct {
			name          string
			displayName   string
			expectError   bool
			errorId       string
			expectedValue string
		}{
			{
				name:          "empty display_name is allowed",
				displayName:   "",
				expectError:   false,
				expectedValue: "",
			},
			{
				name:          "display_name with surrounding whitespace is trimmed",
				displayName:   "  Department Head  ",
				expectError:   false,
				expectedValue: "Department Head",
			},
			{
				name:          "all-whitespace display_name is trimmed to empty and allowed",
				displayName:   "   ",
				expectError:   false,
				expectedValue: "",
			},
			{
				name:          "display_name at exactly 255 runes is accepted",
				displayName:   strings.Repeat("a", PropertyFieldNameMaxRunes),
				expectError:   false,
				expectedValue: strings.Repeat("a", PropertyFieldNameMaxRunes),
			},
			{
				name:        "display_name at 256 runes is rejected",
				displayName: strings.Repeat("a", PropertyFieldNameMaxRunes+1),
				expectError: true,
				errorId:     "app.custom_profile_attributes.sanitize_and_validate.display_name_too_long.app_error",
			},
		}

		for _, tt := range displayNameTests {
			t.Run(tt.name, func(t *testing.T) {
				field := &CPAField{
					PropertyField: PropertyField{
						Type: PropertyFieldTypeText,
					},
					Attrs: CPAAttrs{
						DisplayName: tt.displayName,
					},
				}
				appErr := field.SanitizeAndValidate()
				if tt.expectError {
					require.NotNil(t, appErr)
					require.Equal(t, tt.errorId, appErr.Id)
				} else {
					require.Nil(t, appErr)
					assert.Equal(t, tt.expectedValue, field.Attrs.DisplayName,
						"DisplayName must be trimmed after SanitizeAndValidate")
				}
			})
		}
	})
}

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
				GroupID: CustomProfileAttributesPropertyGroupName,
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

	t.Run("empty DisplayName round-trips as empty string", func(t *testing.T) {
		field := &CPAField{
			PropertyField: PropertyField{
				ID:      NewId(),
				GroupID: CustomProfileAttributesPropertyGroupName,
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

func TestSanitizeAndValidatePropertyValue(t *testing.T) {
	t.Run("text field type", func(t *testing.T) {
		t.Run("valid text", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeText}}, json.RawMessage(`"hello world"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "hello world", value)
		})

		t.Run("empty text should be allowed", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeText}}, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})

		t.Run("invalid JSON", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeText}}, json.RawMessage(`invalid`))
			require.Error(t, err)
		})

		t.Run("wrong type", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeText}}, json.RawMessage(`123`))
			require.Error(t, err)
			require.Contains(t, err.Error(), "json: cannot unmarshal number into Go value of type string")
		})

		t.Run("value too long", func(t *testing.T) {
			longValue := strings.Repeat("a", CPAValueTypeTextMaxLength+1)
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeText}}, json.RawMessage(fmt.Sprintf(`"%s"`, longValue)))
			require.Error(t, err)
			require.Equal(t, "value too long", err.Error())
		})
	})

	t.Run("date field type", func(t *testing.T) {
		t.Run("valid date", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeDate}}, json.RawMessage(`"2023-01-01"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "2023-01-01", value)
		})

		t.Run("empty date should be allowed", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeDate}}, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})
	})

	t.Run("select field type", func(t *testing.T) {
		t.Run("valid option", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{
				PropertyField: PropertyField{Type: PropertyFieldTypeSelect},
				Attrs: CPAAttrs{
					Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
						{ID: "option1"},
					},
				}}, json.RawMessage(`"option1"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "option1", value)
		})

		t.Run("invalid option", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeSelect}}, json.RawMessage(`"option1"`))
			require.Error(t, err)
		})

		t.Run("empty option should be allowed", func(t *testing.T) {
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeSelect}}, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})
	})

	t.Run("user field type", func(t *testing.T) {
		t.Run("valid user ID", func(t *testing.T) {
			validID := NewId()
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeUser}}, json.RawMessage(fmt.Sprintf(`"%s"`, validID)))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, validID, value)
		})

		t.Run("empty user ID should be allowed", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeUser}}, json.RawMessage(`""`))
			require.NoError(t, err)
		})

		t.Run("invalid user ID format", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeUser}}, json.RawMessage(`"invalid-id"`))
			require.Error(t, err)
			require.Equal(t, "invalid user id", err.Error())
		})
	})

	t.Run("multiselect field type", func(t *testing.T) {
		t.Run("valid options", func(t *testing.T) {
			option1ID := NewId()
			option2ID := NewId()
			option3ID := NewId()
			result, err := SanitizeAndValidatePropertyValue(&CPAField{
				PropertyField: PropertyField{Type: PropertyFieldTypeMultiselect},
				Attrs: CPAAttrs{
					Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
						{ID: option1ID},
						{ID: option2ID},
						{ID: option3ID},
					},
				}}, json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, option1ID, option2ID)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{option1ID, option2ID}, values)
		})

		t.Run("empty array", func(t *testing.T) {
			option1ID := NewId()
			option2ID := NewId()
			option3ID := NewId()
			_, err := SanitizeAndValidatePropertyValue(&CPAField{
				PropertyField: PropertyField{Type: PropertyFieldTypeMultiselect},
				Attrs: CPAAttrs{
					Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
						{ID: option1ID},
						{ID: option2ID},
						{ID: option3ID},
					},
				}}, json.RawMessage(`[]`))
			require.NoError(t, err)
		})

		t.Run("array with empty values should filter them out", func(t *testing.T) {
			option1ID := NewId()
			option2ID := NewId()
			option3ID := NewId()
			result, err := SanitizeAndValidatePropertyValue(&CPAField{
				PropertyField: PropertyField{Type: PropertyFieldTypeMultiselect},
				Attrs: CPAAttrs{
					Options: PropertyOptions[*CustomProfileAttributesSelectOption]{
						{ID: option1ID},
						{ID: option2ID},
						{ID: option3ID},
					},
				}}, json.RawMessage(fmt.Sprintf(`["%s", "", "%s", "   ", "%s"]`, option1ID, option2ID, option3ID)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{option1ID, option2ID, option3ID}, values)
		})
	})

	t.Run("multiuser field type", func(t *testing.T) {
		t.Run("valid user IDs", func(t *testing.T) {
			validID1 := NewId()
			validID2 := NewId()
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeMultiuser}}, json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, validID1, validID2)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{validID1, validID2}, values)
		})

		t.Run("empty array", func(t *testing.T) {
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeMultiuser}}, json.RawMessage(`[]`))
			require.NoError(t, err)
		})

		t.Run("array with empty strings should be filtered out", func(t *testing.T) {
			validID1 := NewId()
			validID2 := NewId()
			result, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeMultiuser}}, json.RawMessage(fmt.Sprintf(`["%s", "", "   ", "%s"]`, validID1, validID2)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{validID1, validID2}, values)
		})

		t.Run("array with invalid ID should return error", func(t *testing.T) {
			validID1 := NewId()
			_, err := SanitizeAndValidatePropertyValue(&CPAField{PropertyField: PropertyField{Type: PropertyFieldTypeMultiuser}}, json.RawMessage(fmt.Sprintf(`["%s", "invalid-id"]`, validID1)))
			require.Error(t, err)
			require.Equal(t, "invalid user id: invalid-id", err.Error())
		})
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
