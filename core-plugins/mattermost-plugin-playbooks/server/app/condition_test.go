// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestConditionExprV1_Evaluate(t *testing.T) {
	propertyFields, propertyValues := createTestFieldsAndValues(t)

	t.Run("is condition - match", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("is condition - no match", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["low_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("is condition - field not exists", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "nonexistent_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - match", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - no match", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - field not exists", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "nonexistent_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("and condition - all true", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("and condition - one false", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("or condition - one true", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("or condition - all false", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("nested conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							Is: &ComparisonCondition{
								FieldID: "priority_id",
								Value:   json.RawMessage(`["high_priority_id"]`),
							},
						},
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - is condition matches one of values", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_b_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - is condition no match", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_z_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - isNot condition when value not in array", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_z_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - isNot condition when value in array", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_b_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("empty condition", func(t *testing.T) {
		condition := &ConditionExprV1{}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("text field case insensitive match", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"FALSE"`), // uppercase should match lowercase "false" in test data
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("text field case insensitive no match", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"FALSE"`), // uppercase should match lowercase "false" in test data, so isNot should return false
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	textFieldTestCases := []struct {
		name       string
		fieldValue *json.RawMessage
		useIsNot   bool
		checkValue json.RawMessage
		expected   bool
	}{
		{"text field IS with no value set and checking non-empty string - should return false", nil, false, json.RawMessage(`"123"`), false},
		{"text field IS with no value set and checking empty string - should return true", nil, false, json.RawMessage(`""`), true},
		{"text field IS NOT with no value set and checking non-empty string - should return true", nil, true, json.RawMessage(`"123"`), true},
		{"text field IS NOT with no value set and checking empty string - should return false", nil, true, json.RawMessage(`""`), false},
		{"text field with empty string - IS condition match", ptrRawMessage(`""`), false, json.RawMessage(`""`), true},
		{"text field with empty string - IS condition no match", ptrRawMessage(`""`), false, json.RawMessage(`"some value"`), false},
		{"text field with empty string - IS NOT condition match", ptrRawMessage(`""`), true, json.RawMessage(`"some value"`), true},
		{"text field with empty string - IS NOT condition no match", ptrRawMessage(`""`), true, json.RawMessage(`""`), false},
		{"text field with specific value - IS condition match", ptrRawMessage(`"hello world"`), false, json.RawMessage(`"hello world"`), true},
		{"text field with specific value - IS condition no match", ptrRawMessage(`"hello world"`), false, json.RawMessage(`"goodbye"`), false},
	}

	for _, tc := range textFieldTestCases {
		t.Run(tc.name, func(t *testing.T) {
			fields := append(propertyFields, PropertyField{
				PropertyField: model.PropertyField{
					ID:   "test_text_field_id",
					Name: "Test Text Field",
					Type: model.PropertyFieldTypeText,
				},
			})

			values := propertyValues
			if tc.fieldValue != nil {
				values = append(values, PropertyValue{
					FieldID: "test_text_field_id",
					Value:   *tc.fieldValue,
				})
			}

			var condition *ConditionExprV1
			if tc.useIsNot {
				condition = &ConditionExprV1{
					IsNot: &ComparisonCondition{
						FieldID: "test_text_field_id",
						Value:   tc.checkValue,
					},
				}
			} else {
				condition = &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: "test_text_field_id",
						Value:   tc.checkValue,
					},
				}
			}

			require.Equal(t, tc.expected, condition.Evaluate(fields, values))
		})
	}

	unsetFieldTestCases := []struct {
		name      string
		fieldType model.PropertyFieldType
		fieldID   string
		fieldName string
		useIsNot  bool
		expected  bool
	}{
		{"select field IS with no value set - should return false", model.PropertyFieldTypeSelect, "unset_select_field_id", "Unset Select Field", false, false},
		{"select field IS NOT with no value set - should return true", model.PropertyFieldTypeSelect, "unset_select_field_id", "Unset Select Field", true, true},
		{"multiselect field IS NOT with no value set - should return true", model.PropertyFieldTypeMultiselect, "unset_multiselect_field_id", "Unset Multiselect Field", true, true},
	}

	for _, tc := range unsetFieldTestCases {
		t.Run(tc.name, func(t *testing.T) {
			fields := append(propertyFields, PropertyField{
				PropertyField: model.PropertyField{
					ID:   tc.fieldID,
					Name: tc.fieldName,
					Type: tc.fieldType,
				},
				Attrs: Attrs{
					Options: model.PropertyOptions[*model.PluginPropertyOption]{
						model.NewPluginPropertyOption("option1_id", "Option 1"),
						model.NewPluginPropertyOption("option2_id", "Option 2"),
					},
				},
			})

			var condition *ConditionExprV1
			if tc.useIsNot {
				condition = &ConditionExprV1{
					IsNot: &ComparisonCondition{
						FieldID: tc.fieldID,
						Value:   json.RawMessage(`["option1_id"]`),
					},
				}
			} else {
				condition = &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: tc.fieldID,
						Value:   json.RawMessage(`["option1_id"]`),
					},
				}
			}

			require.Equal(t, tc.expected, condition.Evaluate(fields, propertyValues))
		})
	}
}

func TestConditionExprV1_JSON(t *testing.T) {
	t.Run("marshal and unmarshal simple is condition", func(t *testing.T) {
		original := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["Critical"]`),
			},
		}

		data, err := json.Marshal(original)
		require.NoError(t, err)

		var unmarshaled ConditionExprV1
		err = json.Unmarshal(data, &unmarshaled)
		require.NoError(t, err)

		require.NotNil(t, unmarshaled.Is)
		require.Equal(t, "severity_id", unmarshaled.Is.FieldID)
		require.Equal(t, json.RawMessage(`["Critical"]`), unmarshaled.Is.Value)
		require.Nil(t, unmarshaled.IsNot)
		require.Nil(t, unmarshaled.And)
		require.Nil(t, unmarshaled.Or)
	})

	t.Run("marshal and unmarshal nested conditions", func(t *testing.T) {
		original := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}

		data, err := json.Marshal(original)
		require.NoError(t, err)

		var unmarshaled ConditionExprV1
		err = json.Unmarshal(data, &unmarshaled)
		require.NoError(t, err)

		require.Len(t, unmarshaled.And, 2)
		require.NotNil(t, unmarshaled.And[0].Is)
		require.Equal(t, "severity_id", unmarshaled.And[0].Is.FieldID)
		require.Len(t, unmarshaled.And[1].Or, 2)
		require.NotNil(t, unmarshaled.And[1].Or[0].Is)
		require.Equal(t, "status_id", unmarshaled.And[1].Or[0].Is.FieldID)
		require.NotNil(t, unmarshaled.And[1].Or[1].IsNot)
		require.Equal(t, "acknowledged_id", unmarshaled.And[1].Or[1].IsNot.FieldID)
	})

	t.Run("unmarshal from JSON string", func(t *testing.T) {
		jsonStr := `{
			"and": [
				{
					"is": {
						"field_id": "severity_id",
						"value": ["Critical"]
					}
				},
				{
					"isNot": {
						"field_id": "acknowledged_id",
						"value": "true"
					}
				}
			]
		}`

		var condition ConditionExprV1
		err := json.Unmarshal([]byte(jsonStr), &condition)
		require.NoError(t, err)

		require.Len(t, condition.And, 2)
		require.NotNil(t, condition.And[0].Is)
		require.Equal(t, "severity_id", condition.And[0].Is.FieldID)
		require.Equal(t, json.RawMessage(`["Critical"]`), condition.And[0].Is.Value)
		require.NotNil(t, condition.And[1].IsNot)
		require.Equal(t, "acknowledged_id", condition.And[1].IsNot.FieldID)
		require.Equal(t, json.RawMessage(`"true"`), condition.And[1].IsNot.Value)
	})
}

func TestIsFunction(t *testing.T) {
	testCases := []struct {
		name      string
		fieldType model.PropertyFieldType
		fieldID   string
		value     json.RawMessage
		checkVal  json.RawMessage
		expected  bool
	}{
		{"text field - match", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"Hello World"`), true},
		{"text field - no match", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"Goodbye"`), false},
		{"text field - case insensitive match", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"hello world"`), true},
		{"text field - case insensitive with mixed case", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"HeLLo WoRLd"`), true},
		{"select field - match", model.PropertyFieldTypeSelect, "select_field", json.RawMessage(`"Option1"`), json.RawMessage(`["Option1"]`), true},
		{"select field - case sensitive no match", model.PropertyFieldTypeSelect, "select_field", json.RawMessage(`"Option1"`), json.RawMessage(`["option1"]`), false},
		{"multiselect field - contains value", model.PropertyFieldTypeMultiselect, "multiselect_field", json.RawMessage(`["A", "B", "C"]`), json.RawMessage(`["B"]`), true},
		{"multiselect field - does not contain value", model.PropertyFieldTypeMultiselect, "multiselect_field", json.RawMessage(`["A", "B", "C"]`), json.RawMessage(`["D"]`), false},
		{"multiselect field - empty array", model.PropertyFieldTypeMultiselect, "multiselect_field", json.RawMessage(`[]`), json.RawMessage(`["A"]`), false},
		{"nil value", model.PropertyFieldTypeText, "empty_field", nil, json.RawMessage(`"anything"`), false},
		{"invalid json for text field", model.PropertyFieldTypeText, "invalid_field", json.RawMessage(`invalid json`), json.RawMessage(`"anything"`), false},
		{"invalid json for multiselect field", model.PropertyFieldTypeMultiselect, "invalid_field", json.RawMessage(`invalid json`), json.RawMessage(`"anything"`), false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			field := PropertyField{
				PropertyField: model.PropertyField{
					ID:   tc.fieldID,
					Type: tc.fieldType,
				},
			}
			pv := PropertyValue{
				FieldID: tc.fieldID,
				Value:   tc.value,
			}
			result := is(field, pv, tc.checkVal)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestIsNotFunction(t *testing.T) {
	testCases := []struct {
		name      string
		fieldType model.PropertyFieldType
		fieldID   string
		value     json.RawMessage
		checkVal  json.RawMessage
		expected  bool
	}{
		{"text field - not match", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"Goodbye"`), true},
		{"text field - match (should return false)", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"Hello World"`), false},
		{"text field - case insensitive match (should return false)", model.PropertyFieldTypeText, "text_field", json.RawMessage(`"Hello World"`), json.RawMessage(`"hello world"`), false},
		{"multiselect field - does not contain value", model.PropertyFieldTypeMultiselect, "multiselect_field", json.RawMessage(`["A", "B", "C"]`), json.RawMessage(`["D"]`), true},
		{"multiselect field - contains value (should return false)", model.PropertyFieldTypeMultiselect, "multiselect_field", json.RawMessage(`["A", "B", "C"]`), json.RawMessage(`["B"]`), false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			field := PropertyField{
				PropertyField: model.PropertyField{
					ID:   tc.fieldID,
					Type: tc.fieldType,
				},
			}
			pv := PropertyValue{
				FieldID: tc.fieldID,
				Value:   tc.value,
			}
			result := isNot(field, pv, tc.checkVal)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestConditionExprV1_Validate(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("valid is condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid isNot condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid and condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid or condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("empty condition fails", func(t *testing.T) {
		condition := &ConditionExprV1{}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition must have at least one operation")
	})

	t.Run("multiple operations fails", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition can only have one operation")
	})

	t.Run("empty and condition fails", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "and condition must have at least one nested condition")
	})

	t.Run("empty or condition fails", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "or condition must have at least one nested condition")
	})

	t.Run("nested condition validation fails", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})

	t.Run("depth limit validation - valid depth", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"value1"`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"value2"`),
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.NoError(t, err)
	})

	t.Run("depth limit validation - exceeds depth", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "field1",
								Value:   json.RawMessage(`"value1"`),
							},
						},
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition nesting depth exceeds maximum allowed")
	})
}

func TestComparisonCondition_Validate(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("valid comparison condition", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "severity_id",
			Value:   json.RawMessage(`["critical_id"]`),
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("empty field_id fails", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "",
			Value:   json.RawMessage(`["critical_id"]`),
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})

	t.Run("empty value is allowed", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "acknowledged_id",
			Value:   json.RawMessage(`""`),
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("nil value should fail validation", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "acknowledged_id",
			Value:   nil,
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "text field condition value must be a string")
	})

	t.Run("null JSON value is allowed", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "acknowledged_id",
			Value:   json.RawMessage("null"),
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("select field with no options should fail", func(t *testing.T) {
		// Create a select field with no options
		emptySelectFields := []PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "empty_select_id",
					Type: model.PropertyFieldTypeSelect,
				},
				Attrs: Attrs{
					Options: model.PropertyOptions[*model.PluginPropertyOption]{},
				},
			},
		}

		condition := &ComparisonCondition{
			FieldID: "empty_select_id",
			Value:   json.RawMessage(`["any_value"]`),
		}
		err := condition.Validate(emptySelectFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition value does not match any valid option for select field")
	})

	t.Run("multiselect field with no options should fail", func(t *testing.T) {
		// Create a multiselect field with no options
		emptyMultiselectFields := []PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "empty_multiselect_id",
					Type: model.PropertyFieldTypeMultiselect,
				},
				Attrs: Attrs{
					Options: model.PropertyOptions[*model.PluginPropertyOption]{},
				},
			},
		}

		condition := &ComparisonCondition{
			FieldID: "empty_multiselect_id",
			Value:   json.RawMessage(`["any_value"]`),
		}
		err := condition.Validate(emptyMultiselectFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition value does not match any valid option for multiselect field")
	})
}

func TestConditionExprV1_Sanitize(t *testing.T) {
	t.Run("sanitize is condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "field1",
				Value:   json.RawMessage(`"  trimmed value  "`),
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"trimmed value"`), condition.Is.Value)
	})

	t.Run("sanitize isNot condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "field1",
				Value:   json.RawMessage(`"\t  spaced\n  "`),
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"spaced"`), condition.IsNot.Value)
	})

	t.Run("sanitize nested and conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"  value1  "`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"  value2  "`),
					},
				},
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"value1"`), condition.And[0].Is.Value)
		require.Equal(t, json.RawMessage(`"value2"`), condition.And[1].IsNot.Value)
	})

	t.Run("sanitize nested or conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"  or_value1  "`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"  or_value2  "`),
					},
				},
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"or_value1"`), condition.Or[0].Is.Value)
		require.Equal(t, json.RawMessage(`"or_value2"`), condition.Or[1].IsNot.Value)
	})
}

func TestComparisonCondition_Sanitize(t *testing.T) {
	t.Run("trim spaces from value", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"  test value  "`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`"test value"`), cc.Value)
	})

	t.Run("trim tabs and newlines", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"\t\n  test  \n\t"`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`"test"`), cc.Value)
	})

	t.Run("empty value after trimming", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"   "`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`""`), cc.Value)
	})
}

func ptrRawMessage(s string) *json.RawMessage {
	rm := json.RawMessage(s)
	return &rm
}

// Test helper function that creates property fields with corresponding values
func createTestFieldsAndValues(t *testing.T) ([]PropertyField, []PropertyValue) {
	t.Helper()

	fields := []PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "severity_id",
				Name: "Severity",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("critical_id", "Critical"),
					model.NewPluginPropertyOption("high_id", "High"),
					model.NewPluginPropertyOption("medium_id", "Medium"),
					model.NewPluginPropertyOption("low_id", "Low"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "acknowledged_id",
				Name: "Acknowledged",
				Type: model.PropertyFieldTypeText,
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "status_id",
				Name: "Status",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("open_id", "Open"),
					model.NewPluginPropertyOption("closed_id", "Closed"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "priority_id",
				Name: "Priority",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("urgent_id", "Urgent"),
					model.NewPluginPropertyOption("high_priority_id", "High"),
					model.NewPluginPropertyOption("normal_id", "Normal"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "categories_id",
				Name: "Categories",
				Type: model.PropertyFieldTypeMultiselect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("cat_a_id", "Category A"),
					model.NewPluginPropertyOption("cat_b_id", "Category B"),
					model.NewPluginPropertyOption("cat_c_id", "Category C"),
				},
			},
		},
	}

	values := []PropertyValue{
		{
			FieldID: "severity_id",
			Value:   json.RawMessage(`"critical_id"`),
		},
		{
			FieldID: "acknowledged_id",
			Value:   json.RawMessage(`"false"`),
		},
		{
			FieldID: "status_id",
			Value:   json.RawMessage(`"open_id"`),
		},
		{
			FieldID: "priority_id",
			Value:   json.RawMessage(`"high_priority_id"`),
		},
		{
			FieldID: "categories_id",
			Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
		},
	}

	return fields, values
}

func TestConditionExprV1_ToString(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("simple is condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Severity" is Critical`, result)
	})

	t.Run("simple isNot condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"false"`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is not "false"`, result)
	})

	t.Run("single value array condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "status_id",
				Value:   json.RawMessage(`["open_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Status" is Open`, result)
	})

	t.Run("multi value array condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Categories" is not [Category A,Category B]`, result)
	})

	t.Run("and condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Severity" is Critical AND "Acknowledged" is not "true"`, result)
	})

	t.Run("or condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Severity" is Low OR "Priority" is High`, result)
	})

	t.Run("nested conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Severity" is Critical AND ("Status" is Open OR "Acknowledged" is not "true")`, result)
	})

	t.Run("text field with empty string", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`""`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is empty`, result)
	})

	t.Run("text field with empty string isNot", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`""`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is not empty`, result)
	})

	t.Run("text field with whitespace-only string", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"   "`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is "   "`, result)
	})

	t.Run("text field with regular string", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"hello world"`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is "hello world"`, result)
	})

	t.Run("text field with null JSON value", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage("null"),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, `"Acknowledged" is empty`, result)
	})

}

func TestCondition_IsValid(t *testing.T) {
	validConditionExprV1 := &ConditionExprV1{
		Is: &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`"test_value"`),
		},
	}

	// Create basic property fields for testing
	testPropertyFields := []PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "test_field",
				Type: model.PropertyFieldTypeText,
			},
		},
	}

	t.Run("creation validation - valid condition", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.NoError(t, err)
	})

	t.Run("creation validation - ID should not be specified", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID should not be specified for creation")
	})

	t.Run("creation validation - playbook ID required", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "playbook ID is required")
	})

	t.Run("creation validation - run conditions cannot be created directly", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "run_123",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "run conditions cannot be created directly")
	})

	t.Run("update validation - valid condition", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.NoError(t, err)
	})

	t.Run("update validation - ID required for updates", func(t *testing.T) {
		condition := Condition{
			ID:            "",
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID is required for updates")
	})

	t.Run("update validation - playbook ID required", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "playbook ID is required")
	})

	t.Run("update validation - run conditions cannot be modified", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "run_123",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "run conditions cannot be modified")
	})

	t.Run("validation - invalid condition expression", func(t *testing.T) {
		invalidConditionExprV1 := ConditionExprV1{
			// Empty condition - should fail validation
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: &invalidConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
	})

	t.Run("validation - multiple validation errors prioritize by order", func(t *testing.T) {
		invalidConditionExprV1 := ConditionExprV1{}
		condition := Condition{
			ID:            "",
			ConditionExpr: &invalidConditionExprV1,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID is required for updates")
	})

	t.Run("validation - condition expression with invalid field type", func(t *testing.T) {
		invalidConditionExprV1 := ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "test_field",
				Value:   json.RawMessage(`["array", "value"]`),
			},
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: &invalidConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}

		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
		require.Contains(t, err.Error(), "text field condition value must be a string")
	})

	t.Run("validation - condition expression structural validation works", func(t *testing.T) {
		invalidConditionExprV1 := ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "",
				Value:   json.RawMessage(`"test"`),
			},
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: &invalidConditionExprV1,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})
}

func TestConditionExprV1_ExtractPropertyIDs(t *testing.T) {
	t.Run("simple is condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.Equal(t, []string{"severity_id"}, fieldIDs)
		require.Equal(t, []string{"critical_id"}, optionIDs)
	})

	t.Run("simple isNot condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"false"`),
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.Equal(t, []string{"acknowledged_id"}, fieldIDs)
		require.Empty(t, optionIDs) // text fields don't contribute option IDs
	})

	t.Run("and condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["open_id", "closed_id"]`),
					},
				},
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.ElementsMatch(t, []string{"severity_id", "status_id"}, fieldIDs)
		require.ElementsMatch(t, []string{"critical_id", "open_id", "closed_id"}, optionIDs)
	})

	t.Run("or condition", func(t *testing.T) {
		condition := &ConditionExprV1{
			Or: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "categories_id",
						Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
					},
				},
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.ElementsMatch(t, []string{"priority_id", "categories_id"}, fieldIDs)
		require.ElementsMatch(t, []string{"high_priority_id", "cat_a_id", "cat_b_id"}, optionIDs)
	})

	t.Run("nested conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.ElementsMatch(t, []string{"severity_id", "status_id", "acknowledged_id"}, fieldIDs)
		require.ElementsMatch(t, []string{"critical_id", "open_id"}, optionIDs) // "true" is not an option ID for text field
	})

	t.Run("mixed field types", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "text_field",
						Value:   json.RawMessage(`"some text"`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "select_field",
						Value:   json.RawMessage(`["option1_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "multiselect_field",
						Value:   json.RawMessage(`["option2_id", "option3_id"]`),
					},
				},
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.ElementsMatch(t, []string{"text_field", "select_field", "multiselect_field"}, fieldIDs)
		require.ElementsMatch(t, []string{"option1_id", "option2_id", "option3_id"}, optionIDs)
	})

	t.Run("empty condition", func(t *testing.T) {
		condition := &ConditionExprV1{}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.Empty(t, fieldIDs)
		require.Empty(t, optionIDs)
	})

	t.Run("duplicate field and option IDs are deduplicated", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "severity_id",                      // duplicate field
						Value:   json.RawMessage(`["critical_id"]`), // duplicate option
					},
				},
			},
		}
		fieldIDs, optionIDs := condition.ExtractPropertyIDs()
		require.Equal(t, []string{"severity_id"}, fieldIDs)  // should be deduplicated
		require.Equal(t, []string{"critical_id"}, optionIDs) // should be deduplicated
	})
}

func TestConditionExprV1_SwapPropertyIDs(t *testing.T) {
	propertyMappings := &PropertyCopyResult{
		FieldMappings: map[string]string{
			"old_severity_id":     "new_severity_id",
			"old_status_id":       "new_status_id",
			"old_acknowledged_id": "new_acknowledged_id",
			"old_priority_id":     "new_priority_id",
		},
		OptionMappings: map[string]string{
			"old_critical_id": "new_critical_id",
			"old_open_id":     "new_open_id",
		},
		CopiedFields: []PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "new_severity_id",
					Type: model.PropertyFieldTypeSelect,
				},
			},
			{
				PropertyField: model.PropertyField{
					ID:   "new_status_id",
					Type: model.PropertyFieldTypeSelect,
				},
			},
			{
				PropertyField: model.PropertyField{
					ID:   "new_acknowledged_id",
					Type: model.PropertyFieldTypeText,
				},
			},
			{
				PropertyField: model.PropertyField{
					ID:   "new_priority_id",
					Type: model.PropertyFieldTypeSelect,
				},
			},
		},
	}

	t.Run("swaps field IDs in nested conditions", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "old_severity_id",
						Value:   json.RawMessage(`["old_critical_id"]`),
					},
				},
				{
					Or: []ConditionExprV1{
						{
							Is: &ComparisonCondition{
								FieldID: "old_status_id",
								Value:   json.RawMessage(`["old_open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "old_acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}

		err := condition.SwapPropertyIDs(propertyMappings)
		require.NoError(t, err)
		require.Equal(t, "new_severity_id", condition.And[0].Is.FieldID)
		require.Equal(t, "new_status_id", condition.And[1].Or[0].Is.FieldID)
		require.Equal(t, "new_acknowledged_id", condition.And[1].Or[1].IsNot.FieldID)
	})

	t.Run("returns error for missing field mapping", func(t *testing.T) {
		condition := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "unmapped_field_id",
				Value:   json.RawMessage(`["value"]`),
			},
		}

		err := condition.SwapPropertyIDs(propertyMappings)
		require.Error(t, err)
		require.Contains(t, err.Error(), "no field mapping found for field ID unmapped_field_id")
	})

	t.Run("empty condition does not fail", func(t *testing.T) {
		condition := &ConditionExprV1{}

		err := condition.SwapPropertyIDs(propertyMappings)
		require.NoError(t, err)
	})

	t.Run("swaps option IDs for select/multiselect fields", func(t *testing.T) {
		condition := &ConditionExprV1{
			And: []ConditionExprV1{
				{
					Is: &ComparisonCondition{
						FieldID: "old_severity_id",
						Value:   json.RawMessage(`["old_critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "old_status_id",
						Value:   json.RawMessage(`["old_open_id"]`),
					},
				},
			},
		}

		err := condition.SwapPropertyIDs(propertyMappings)
		require.NoError(t, err)

		// Check that field IDs are swapped
		require.Equal(t, "new_severity_id", condition.And[0].Is.FieldID)
		require.Equal(t, "new_status_id", condition.And[1].IsNot.FieldID)

		// Check that option IDs are also swapped for select fields
		var severityOptions []string
		err = json.Unmarshal(condition.And[0].Is.Value, &severityOptions)
		require.NoError(t, err)
		require.Equal(t, []string{"new_critical_id"}, severityOptions)

		var statusOptions []string
		err = json.Unmarshal(condition.And[1].IsNot.Value, &statusOptions)
		require.NoError(t, err)
		require.Equal(t, []string{"new_open_id"}, statusOptions)
	})
}

func TestConditionEvaluationResult_AnythingChanged(t *testing.T) {
	testCases := []struct {
		name     string
		changes  map[string]*ChecklistConditionChanges
		expected bool
	}{
		{"returns false for empty result", make(map[string]*ChecklistConditionChanges), false},
		{
			"returns false when no changes",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 0, Hidden: 0, hasChanges: false},
				"Checklist 2": {Added: 0, Hidden: 0, hasChanges: false},
			},
			false,
		},
		{
			"returns true when items added",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 2, Hidden: 0, hasChanges: true},
			},
			true,
		},
		{
			"returns true when items hidden",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 0, Hidden: 3, hasChanges: true},
			},
			true,
		},
		{
			"returns true when both added and hidden",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 1, Hidden: 2, hasChanges: true},
				"Checklist 2": {Added: 0, Hidden: 0, hasChanges: false},
			},
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := &ConditionEvaluationResult{
				ChecklistChanges: tc.changes,
			}
			require.Equal(t, tc.expected, result.AnythingChanged())
		})
	}
}

func TestConditionEvaluationResult_AnythingAdded(t *testing.T) {
	testCases := []struct {
		name     string
		changes  map[string]*ChecklistConditionChanges
		expected bool
	}{
		{"returns false for empty result", make(map[string]*ChecklistConditionChanges), false},
		{
			"returns false when no items added",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 0, Hidden: 5},
				"Checklist 2": {Added: 0, Hidden: 0},
			},
			false,
		},
		{
			"returns true when items added",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 1, Hidden: 0},
			},
			true,
		},
		{
			"returns true when items added even with hidden items",
			map[string]*ChecklistConditionChanges{
				"Checklist 1": {Added: 0, Hidden: 2},
				"Checklist 2": {Added: 3, Hidden: 1},
			},
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := &ConditionEvaluationResult{
				ChecklistChanges: tc.changes,
			}
			require.Equal(t, tc.expected, result.AnythingAdded())
		})
	}
}
