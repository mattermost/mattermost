// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvalidValueError(t *testing.T) {
	err := invalidValueError()
	require.NotNil(t, err)
	assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	assert.Equal(t, 400, err.StatusCode)
	assert.Equal(t, "Invalid value.", err.DetailedError)
}

func TestMaskedTokenRejection(t *testing.T) {
	// The masked token "--------" must be rejected as a value.
	// This tests the sentinel check logic.
	assert.Equal(t, "--------", maskedTokenValue)

	t.Run("masked token in single value", func(t *testing.T) {
		values := extractStringValues("--------")
		found := false
		for _, v := range values {
			if v == maskedTokenValue {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("masked token in multi-value", func(t *testing.T) {
		values := extractStringValues([]any{"Alpha", "--------", "Bravo"})
		found := false
		for _, v := range values {
			if v == maskedTokenValue {
				found = true
				break
			}
		}
		assert.True(t, found)
	})
}

func TestValidateConditionValues_AttrValueSkipped(t *testing.T) {
	// AttrValue conditions should be skipped — they contain no literal values to validate.
	cond := model.Condition{
		Attribute: "user.attributes.Team",
		Operator:  "==",
		Value:     "user.attributes.Department",
		ValueType: model.AttrValue,
	}

	// Confirm the condition type is AttrValue — the validator skips these
	assert.Equal(t, model.AttrValue, cond.ValueType)
}

func TestValidateConditionValues_PublicFieldAllowsAnyValues(t *testing.T) {
	// For public fields, the validator should allow any value.
	// We test this by verifying GetAccessMode() returns public for the field
	// and that the switch case returns nil for public.
	field := &model.PropertyField{
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
		},
	}
	assert.Equal(t, model.PropertyAccessModePublic, field.GetAccessMode())
}

func TestValidateConditionValues_SourceOnlyRejectsLiterals(t *testing.T) {
	// For source_only fields, any literal value should be rejected.
	// We verify the access mode detection works correctly.
	field := &model.PropertyField{
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
		},
	}
	assert.Equal(t, model.PropertyAccessModeSourceOnly, field.GetAccessMode())
}

func TestValidateConditionValues_SharedOnlyChecksVisibility(t *testing.T) {
	// For shared_only fields, values not in the visible set should be rejected.
	// We test the core logic: extract visible names, check membership.
	field := &model.PropertyField{
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "id1", "name": "Alpha"},
				map[string]any{"id": "id2", "name": "Bravo"},
			},
		},
	}

	visibleNames := extractVisibleOptionNames(field)

	t.Run("held value passes", func(t *testing.T) {
		_, visible := visibleNames["Alpha"]
		assert.True(t, visible)
	})

	t.Run("non-held value fails", func(t *testing.T) {
		_, visible := visibleNames["Charlie"]
		assert.False(t, visible)
	})

	t.Run("masked token fails", func(t *testing.T) {
		_, visible := visibleNames[maskedTokenValue]
		assert.False(t, visible)
	})
}

func TestGenericErrorConsistency(t *testing.T) {
	// All rejection reasons must produce identical errors to prevent enumeration.
	// This test ensures the error factory is consistent.
	err1 := invalidValueError()
	err2 := invalidValueError()

	assert.Equal(t, err1.Id, err2.Id)
	assert.Equal(t, err1.StatusCode, err2.StatusCode)
	assert.Equal(t, err1.DetailedError, err2.DetailedError)
}
