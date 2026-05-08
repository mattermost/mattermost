// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConditionJSON_HasMaskedValuesOmitEmpty(t *testing.T) {
	t.Run("has_masked_values omitted when false", func(t *testing.T) {
		condition := Condition{
			Attribute:       "user.attributes.Program",
			Operator:        "==",
			Value:           "Alpha",
			ValueType:       LiteralValue,
			AttributeType:   "select",
			HasMaskedValues: false,
		}

		data, err := json.Marshal(condition)
		require.NoError(t, err)

		// has_masked_values should NOT appear in JSON when false (omitempty)
		assert.NotContains(t, string(data), "has_masked_values")
	})

	t.Run("has_masked_values present when true", func(t *testing.T) {
		condition := Condition{
			Attribute:       "user.attributes.Program",
			Operator:        "in",
			Value:           []any{"Alpha"},
			ValueType:       LiteralValue,
			AttributeType:   "multiselect",
			HasMaskedValues: true,
		}

		data, err := json.Marshal(condition)
		require.NoError(t, err)

		assert.Contains(t, string(data), `"has_masked_values":true`)
	})

	t.Run("has_masked_values defaults to false on unmarshal when absent", func(t *testing.T) {
		// Simulate a response from an older server that doesn't include has_masked_values
		jsonData := `{"attribute":"user.attributes.Team","operator":"==","value":"Engineering","value_type":0,"attribute_type":"select"}`

		var condition Condition
		err := json.Unmarshal([]byte(jsonData), &condition)
		require.NoError(t, err)

		assert.Equal(t, "user.attributes.Team", condition.Attribute)
		assert.Equal(t, "==", condition.Operator)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("has_masked_values round-trips correctly when true", func(t *testing.T) {
		original := Condition{
			Attribute:       "user.attributes.Program",
			Operator:        "in",
			Value:           []any{"Alpha", "Bravo"},
			ValueType:       LiteralValue,
			AttributeType:   "multiselect",
			HasMaskedValues: true,
		}

		data, err := json.Marshal(original)
		require.NoError(t, err)

		var decoded Condition
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)

		assert.Equal(t, original.Attribute, decoded.Attribute)
		assert.Equal(t, original.Operator, decoded.Operator)
		assert.Equal(t, original.AttributeType, decoded.AttributeType)
		assert.True(t, decoded.HasMaskedValues)
	})
}

func TestVisualExpressionJSON(t *testing.T) {
	t.Run("visual expression with mixed masked and unmasked conditions", func(t *testing.T) {
		ve := VisualExpression{
			Conditions: []Condition{
				{
					Attribute:       "user.attributes.Program",
					Operator:        "in",
					Value:           []any{"Alpha"},
					ValueType:       LiteralValue,
					AttributeType:   "multiselect",
					HasMaskedValues: true,
				},
				{
					Attribute:     "user.attributes.Location",
					Operator:      "==",
					Value:         "Building 1",
					ValueType:     LiteralValue,
					AttributeType: "select",
					// HasMaskedValues defaults to false — no masking on this condition
				},
			},
		}

		data, err := json.Marshal(ve)
		require.NoError(t, err)

		jsonStr := string(data)

		// First condition should have has_masked_values
		assert.Contains(t, jsonStr, `"has_masked_values":true`)

		var decoded VisualExpression
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)

		require.Len(t, decoded.Conditions, 2)
		assert.True(t, decoded.Conditions[0].HasMaskedValues)
		assert.False(t, decoded.Conditions[1].HasMaskedValues)
	})
}
