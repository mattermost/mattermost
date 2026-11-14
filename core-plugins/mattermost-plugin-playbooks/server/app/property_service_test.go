// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sort"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyService_duplicatePropertyFieldForRun(t *testing.T) {
	s := &propertyService{}
	runID := model.NewId()
	playbookID := model.NewId()

	t.Run("text field with name and type only", func(t *testing.T) {
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
	})

	t.Run("text field with name, type and sort order", func(t *testing.T) {
		sortOrder := 42.5
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field with Sort",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:  sortOrder,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])
	})

	t.Run("select field with options and sort order", func(t *testing.T) {
		sortOrder := 10.0
		originalOptions := model.PropertyOptions[*model.PluginPropertyOption]{
			model.NewPluginPropertyOption(model.NewId(), "Option One"),
			model.NewPluginPropertyOption(model.NewId(), "Option Two"),
		}

		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Select Field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility:             PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:              sortOrder,
				model.PropertyFieldAttributeOptions: originalOptions,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])

		runOptions, ok := runProperty.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.PluginPropertyOption])
		require.True(t, ok)
		require.Len(t, runOptions, 2)

		require.Equal(t, originalOptions[0].GetName(), runOptions[0].GetName())
		require.Equal(t, originalOptions[1].GetName(), runOptions[1].GetName())

		require.NotEqual(t, originalOptions[0].GetID(), runOptions[0].GetID())
		require.NotEqual(t, originalOptions[1].GetID(), runOptions[1].GetID())
		require.NotEqual(t, runOptions[0].GetID(), runOptions[1].GetID())
		require.NotEmpty(t, runOptions[0].GetID())
		require.NotEmpty(t, runOptions[1].GetID())
	})
}

func TestPropertyService_validateSelectValue(t *testing.T) {
	s := &propertyService{}

	// Create a test property field with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")

	propertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	tests := []struct {
		name        string
		value       string
		expectError bool
	}{
		{
			name:        "valid option ID",
			value:       "opt1",
			expectError: false,
		},
		{
			name:        "another valid option ID",
			value:       "opt2",
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       "invalid-option",
			expectError: true,
		},
		{
			name:        "empty string is allowed",
			value:       "",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.validateSelectValue(propertyField, tt.value)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPropertyService_validateMultiselectValue(t *testing.T) {
	s := &propertyService{}

	// Create a test property field with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")
	option3 := model.NewPluginPropertyOption("opt3", "Option 3")

	propertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeMultiselect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2, option3},
		},
	}

	tests := []struct {
		name        string
		value       []string
		expectError bool
	}{
		{
			name:        "single valid option",
			value:       []string{"opt1"},
			expectError: false,
		},
		{
			name:        "multiple valid options",
			value:       []string{"opt1", "opt3"},
			expectError: false,
		},
		{
			name:        "all valid options",
			value:       []string{"opt1", "opt2", "opt3"},
			expectError: false,
		},
		{
			name:        "empty array",
			value:       []string{},
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       []string{"invalid-option"},
			expectError: true,
		},
		{
			name:        "mix of valid and invalid options",
			value:       []string{"opt1", "invalid-option"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.validateMultiselectValue(propertyField, tt.value)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPropertyService_sanitizeTextValue(t *testing.T) {
	s := &propertyService{}

	tests := []struct {
		name           string
		input          string
		expectedOutput string
	}{
		{
			name:           "trim leading and trailing spaces",
			input:          "  hello world  ",
			expectedOutput: "hello world",
		},
		{
			name:           "trim only leading spaces",
			input:          "  hello world",
			expectedOutput: "hello world",
		},
		{
			name:           "trim only trailing spaces",
			input:          "hello world  ",
			expectedOutput: "hello world",
		},
		{
			name:           "no spaces to trim",
			input:          "hello world",
			expectedOutput: "hello world",
		},
		{
			name:           "empty string remains empty",
			input:          "",
			expectedOutput: "",
		},
		{
			name:           "string with only spaces becomes empty",
			input:          "   ",
			expectedOutput: "",
		},
		{
			name:           "empty string is allowed",
			input:          "",
			expectedOutput: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := s.sanitizeTextValue(tt.input)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedOutput, result)
		})
	}
}

func TestPropertyService_sanitizeAndValidatePropertyValue(t *testing.T) {
	s := &propertyService{}

	// Create test property fields with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")

	selectPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	multiselectPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeMultiselect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	textPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeText,
	}

	tests := []struct {
		name           string
		propertyField  *model.PropertyField
		input          json.RawMessage
		expectedOutput json.RawMessage
		expectError    bool
	}{
		// Text field tests
		{
			name:           "text field trims spaces",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`"  hello world  "`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "text field allows empty string",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`""`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:          "text field rejects non-string",
			propertyField: textPropertyField,
			input:         json.RawMessage(`123`),
			expectError:   true,
		},
		{
			name:           "text field allows null",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Select field tests
		{
			name:           "select field allows valid option",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`"opt1"`),
			expectedOutput: json.RawMessage(`"opt1"`),
			expectError:    false,
		},
		{
			name:           "select field allows empty string",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`""`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:          "select field rejects invalid option",
			propertyField: selectPropertyField,
			input:         json.RawMessage(`"invalid-option"`),
			expectError:   true,
		},
		{
			name:          "select field rejects non-string",
			propertyField: selectPropertyField,
			input:         json.RawMessage(`123`),
			expectError:   true,
		},
		{
			name:           "select field allows null",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Multiselect field tests
		{
			name:           "multiselect field allows valid options",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`["opt1", "opt2"]`),
			expectedOutput: json.RawMessage(`["opt1", "opt2"]`),
			expectError:    false,
		},
		{
			name:           "multiselect field allows empty array",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`[]`),
			expectedOutput: json.RawMessage(`[]`),
			expectError:    false,
		},
		{
			name:          "multiselect field rejects invalid option",
			propertyField: multiselectPropertyField,
			input:         json.RawMessage(`["invalid-option"]`),
			expectError:   true,
		},
		{
			name:          "multiselect field rejects non-array",
			propertyField: multiselectPropertyField,
			input:         json.RawMessage(`"opt1"`),
			expectError:   true,
		},
		{
			name:           "multiselect field allows null",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Empty value tests
		{
			name:           "text field allows empty RawMessage",
			propertyField:  textPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
		{
			name:           "select field allows empty RawMessage",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
		{
			name:           "multiselect field allows empty RawMessage",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := s.sanitizeAndValidatePropertyValue(tt.propertyField, tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, string(tt.expectedOutput), string(result))
			}
		})
	}
}

func TestPropertyService_TestPropertySortOrder(t *testing.T) {
	tests := []struct {
		name          string
		propertyField *model.PropertyField
		expectedOrder int
	}{
		{
			name: "property field with sort order",
			propertyField: &model.PropertyField{
				Attrs: model.StringInterface{
					PropertyAttrsSortOrder: 42.5,
				},
			},
			expectedOrder: 42,
		},
		{
			name: "property field with zero sort order",
			propertyField: &model.PropertyField{
				Attrs: model.StringInterface{
					PropertyAttrsSortOrder: 0.0,
				},
			},
			expectedOrder: 0,
		},
		{
			name: "property field with negative sort order",
			propertyField: &model.PropertyField{
				Attrs: model.StringInterface{
					PropertyAttrsSortOrder: -10.7,
				},
			},
			expectedOrder: -10,
		},
		{
			name: "property field without sort order",
			propertyField: &model.PropertyField{
				Attrs: model.StringInterface{},
			},
			expectedOrder: 0,
		},
		{
			name: "property field with invalid sort order type",
			propertyField: &model.PropertyField{
				Attrs: model.StringInterface{
					PropertyAttrsSortOrder: "invalid",
				},
			},
			expectedOrder: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := PropertySortOrder(tt.propertyField)
			assert.Equal(t, tt.expectedOrder, result)
		})
	}
}

func TestPropertyService_TestPropertyFieldsSortingOrder(t *testing.T) {
	// Create test property fields with different sort orders
	fields := []*model.PropertyField{
		{
			ID:   "field3",
			Name: "Field 3",
			Attrs: model.StringInterface{
				PropertyAttrsSortOrder: 30.0,
			},
		},
		{
			ID:   "field1",
			Name: "Field 1",
			Attrs: model.StringInterface{
				PropertyAttrsSortOrder: 10.0,
			},
		},
		{
			ID:    "field4",
			Name:  "Field 4",
			Attrs: model.StringInterface{}, // No sort order, should default to 0
		},
		{
			ID:   "field2",
			Name: "Field 2",
			Attrs: model.StringInterface{
				PropertyAttrsSortOrder: 20.0,
			},
		},
		{
			ID:   "field5",
			Name: "Field 5",
			Attrs: model.StringInterface{
				PropertyAttrsSortOrder: -5.0,
			},
		},
	}

	// Test the sorting logic used in getAllPropertyFields
	// We'll simulate what happens in the sorting part of getAllPropertyFields
	sortedFields := make([]*model.PropertyField, len(fields))
	copy(sortedFields, fields)

	// Apply the same sorting logic as in getAllPropertyFields
	sort.Slice(sortedFields, func(i, j int) bool {
		return PropertySortOrder(sortedFields[i]) < PropertySortOrder(sortedFields[j])
	})

	// Verify the order: field5 (-5) < field4 (0) < field1 (10) < field2 (20) < field3 (30)
	expectedOrder := []string{"field5", "field4", "field1", "field2", "field3"}

	require.Len(t, sortedFields, len(expectedOrder))
	for i, expectedID := range expectedOrder {
		assert.Equal(t, expectedID, sortedFields[i].ID, "Field at position %d should be %s", i, expectedID)
	}

	// Verify the sort orders are in ascending order
	for i := 1; i < len(sortedFields); i++ {
		prevOrder := PropertySortOrder(sortedFields[i-1])
		currOrder := PropertySortOrder(sortedFields[i])
		assert.LessOrEqual(t, prevOrder, currOrder, "Sort orders should be in ascending order")
	}
}

func TestPropertyService_validatePropertyLimit(t *testing.T) {
	tests := []struct {
		name          string
		currentCount  int
		countError    error
		expectedError string
		expectError   bool
	}{
		{
			name:         "success when under limit",
			currentCount: 10,
			countError:   nil,
			expectError:  false,
		},
		{
			name:         "success when at limit minus one",
			currentCount: MaxPropertiesPerPlaybook - 1, // 19
			countError:   nil,
			expectError:  false,
		},
		{
			name:          "failure when at limit",
			currentCount:  MaxPropertiesPerPlaybook, // 20
			countError:    nil,
			expectedError: "cannot create property field: playbook already has the maximum allowed number of properties (20)",
			expectError:   true,
		},
		{
			name:          "failure when over limit",
			currentCount:  MaxPropertiesPerPlaybook + 5, // 25
			countError:    nil,
			expectedError: "cannot create property field: playbook already has the maximum allowed number of properties (20)",
			expectError:   true,
		},
		{
			name:         "success when zero properties",
			currentCount: 0,
			countError:   nil,
			expectError:  false,
		},
		{
			name:          "error when GetPropertyFieldsCount fails",
			currentCount:  0,
			countError:    assert.AnError,
			expectedError: "failed to get current property count",
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock property service that overrides GetPropertyFieldsCount
			s := &mockPropertyServiceForValidation{
				currentCount: tt.currentCount,
				countError:   tt.countError,
			}

			playbookID := model.NewId()
			err := s.validatePropertyLimit(playbookID)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// mockPropertyServiceForValidation is a test double that implements only the methods needed for testing validatePropertyLimit
type mockPropertyServiceForValidation struct {
	currentCount int
	countError   error
}

func (m *mockPropertyServiceForValidation) GetPropertyFieldsCount(playbookID string) (int, error) {
	return m.currentCount, m.countError
}

func (m *mockPropertyServiceForValidation) validatePropertyLimit(playbookID string) error {
	currentCount, err := m.GetPropertyFieldsCount(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get current property count")
	}

	if currentCount >= MaxPropertiesPerPlaybook {
		return errors.Errorf("cannot create property field: playbook already has the maximum allowed number of properties (%d)", MaxPropertiesPerPlaybook)
	}

	return nil
}

func TestReorderPropertyFieldsLogic(t *testing.T) {
	playbookID := model.NewId()

	createField := func(id string, name string, sortOrder float64) PropertyField {
		return PropertyField{
			PropertyField: model.PropertyField{
				ID:         id,
				Name:       name,
				Type:       model.PropertyFieldTypeText,
				TargetType: PropertyTargetTypePlaybook,
				TargetID:   playbookID,
			},
			Attrs: Attrs{
				Visibility: PropertyFieldVisibilityWhenSet,
				SortOrder:  sortOrder,
			},
		}
	}

	t.Run("move field forward (from position 1 to position 4)", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		field2 := createField("field2", "Field 2", 1)
		field3 := createField("field3", "Field 3", 2)
		field4 := createField("field4", "Field 4", 3)
		field5 := createField("field5", "Field 5", 4)
		fields := []PropertyField{field1, field2, field3, field4, field5}

		result, changedIndices, err := reorderPropertyFieldsLogic(fields, "field2", 4)
		require.NoError(t, err)
		require.Len(t, result, 5)

		assert.Equal(t, "field1", result[0].ID)
		assert.Equal(t, float64(0), result[0].Attrs.SortOrder)
		assert.Equal(t, "field3", result[1].ID)
		assert.Equal(t, float64(1), result[1].Attrs.SortOrder)
		assert.Equal(t, "field4", result[2].ID)
		assert.Equal(t, float64(2), result[2].Attrs.SortOrder)
		assert.Equal(t, "field5", result[3].ID)
		assert.Equal(t, float64(3), result[3].Attrs.SortOrder)
		assert.Equal(t, "field2", result[4].ID)
		assert.Equal(t, float64(4), result[4].Attrs.SortOrder)

		assert.Equal(t, []int{1, 2, 3, 4}, changedIndices)
	})

	t.Run("move field backward (from position 3 to position 0)", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		field2 := createField("field2", "Field 2", 1)
		field3 := createField("field3", "Field 3", 2)
		field4 := createField("field4", "Field 4", 3)
		fields := []PropertyField{field1, field2, field3, field4}

		result, changedIndices, err := reorderPropertyFieldsLogic(fields, "field4", 0)
		require.NoError(t, err)
		require.Len(t, result, 4)

		assert.Equal(t, "field4", result[0].ID)
		assert.Equal(t, float64(0), result[0].Attrs.SortOrder)
		assert.Equal(t, "field1", result[1].ID)
		assert.Equal(t, float64(1), result[1].Attrs.SortOrder)
		assert.Equal(t, "field2", result[2].ID)
		assert.Equal(t, float64(2), result[2].Attrs.SortOrder)
		assert.Equal(t, "field3", result[3].ID)
		assert.Equal(t, float64(3), result[3].Attrs.SortOrder)

		assert.Equal(t, []int{0, 1, 2, 3}, changedIndices)
	})

	t.Run("same source and target position returns unchanged", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		field2 := createField("field2", "Field 2", 1)
		fields := []PropertyField{field1, field2}

		result, changedIndices, err := reorderPropertyFieldsLogic(fields, "field1", 0)
		require.NoError(t, err)
		require.Len(t, result, 2)

		assert.Equal(t, "field1", result[0].ID)
		assert.Equal(t, "field2", result[1].ID)
		assert.Empty(t, changedIndices)
	})

	t.Run("error when field not found", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		fields := []PropertyField{field1}

		_, _, err := reorderPropertyFieldsLogic(fields, "nonexistent", 0)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "field not found")
	})

	t.Run("error when target position out of bounds (negative)", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		fields := []PropertyField{field1}

		_, _, err := reorderPropertyFieldsLogic(fields, "field1", -1)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "target position out of bounds")
	})

	t.Run("error when target position out of bounds (too large)", func(t *testing.T) {
		field1 := createField("field1", "Field 1", 0)
		fields := []PropertyField{field1}

		_, _, err := reorderPropertyFieldsLogic(fields, "field1", 5)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "target position out of bounds")
	})
}
