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
	tests := []struct {
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
			name: "property field with empty attributes",
			propertyField: &PropertyField{
				ID:       NewId(),
				GroupID:  CustomProfileAttributesPropertyGroupName,
				Name:     "Empty Field",
				Type:     PropertyFieldTypeText,
				CreateAt: GetMillis(),
				UpdateAt: GetMillis(),
			},
			wantAttrs: CPAAttrs{
				Visibility: "",
				SortOrder:  0,
				ValueType:  "",
				Options:    nil,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cpaField, err := NewCPAFieldFromPropertyField(tt.propertyField)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, cpaField)

			// Check that the PropertyField was copied correctly
			assert.Equal(t, tt.propertyField.ID, cpaField.ID)
			assert.Equal(t, tt.propertyField.GroupID, cpaField.GroupID)
			assert.Equal(t, tt.propertyField.Name, cpaField.Name)
			assert.Equal(t, tt.propertyField.Type, cpaField.Type)

			// Check that the attributes were parsed correctly
			assert.Equal(t, tt.wantAttrs.Visibility, cpaField.Attrs.Visibility)
			assert.Equal(t, tt.wantAttrs.SortOrder, cpaField.Attrs.SortOrder)
			assert.Equal(t, tt.wantAttrs.ValueType, cpaField.Attrs.ValueType)

			// For options, we need to check length since IDs will be different
			if tt.wantAttrs.Options != nil {
				require.NotNil(t, cpaField.Attrs.Options)
				assert.Len(t, cpaField.Attrs.Options, len(tt.wantAttrs.Options))
				if len(tt.wantAttrs.Options) > 0 {
					assert.Equal(t, tt.wantAttrs.Options[0].Name, cpaField.Attrs.Options[0].Name)
					assert.Equal(t, tt.wantAttrs.Options[0].Color, cpaField.Attrs.Options[0].Color)
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
}
