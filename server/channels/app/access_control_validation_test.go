// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

func TestMaskedTokenConstant(t *testing.T) {
	// The masked-token sentinel must be the eight-dash string the frontend
	// renders for hidden chips and the server emits when masking raw CEL
	// on GET / search responses.
	assert.Equal(t, "--------", maskedTokenValue)
}

func TestGenericErrorConsistency(t *testing.T) {
	// All rejection reasons must produce identical errors to prevent enumeration.
	err1 := invalidValueError()
	err2 := invalidValueError()

	assert.Equal(t, err1.Id, err2.Id)
	assert.Equal(t, err1.StatusCode, err2.StatusCode)
	assert.Equal(t, err1.DetailedError, err2.DetailedError)
}

func TestValidateConditionValues(t *testing.T) {
	rctx := request.TestContext(t)

	// nil App is safe for every branch except shared_only + text (which calls
	// a.getCallerTextValues → a.SearchPropertyValues). Those paths are covered
	// by the integration tests in access_control_test.go.
	var a *App

	makeField := func(accessMode string, fieldType model.PropertyFieldType, options []any) *model.PropertyField {
		attrs := model.StringInterface{model.PropertyAttrsAccessMode: accessMode}
		if options != nil {
			attrs[model.PropertyFieldAttributeOptions] = options
		}
		return &model.PropertyField{Name: "Team", Type: fieldType, Attrs: attrs}
	}

	selectOptions := []any{
		map[string]any{"id": "id1", "name": "Alpha"},
		map[string]any{"id": "id2", "name": "Bravo"},
	}

	t.Run("AttrValue conditions are skipped (no literals to validate)", func(t *testing.T) {
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "user.attributes.Department",
			ValueType: model.AttrValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", nil)
		assert.Nil(t, err)
	})

	t.Run("non-attribute references are skipped", func(t *testing.T) {
		cond := &model.Condition{
			Attribute: "channel.id",
			Operator:  "==",
			Value:     "X",
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", nil)
		assert.Nil(t, err)
	})

	t.Run("unknown field is rejected with the generic error", func(t *testing.T) {
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", map[string]*model.PropertyField{})
		require.NotNil(t, err)
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	})

	t.Run("public field allows any value", func(t *testing.T) {
		field := makeField(model.PropertyAccessModePublic, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "anything",
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", fields)
		assert.Nil(t, err)
	})

	t.Run("source_only field rejects any literal value", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSourceOnly, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", fields)
		require.NotNil(t, err)
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	})

	t.Run("source_only field allows the masked-token sentinel (round-tripped from GET)", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSourceOnly, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     maskedTokenValue,
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", fields)
		assert.Nil(t, err, "the sentinel is stripped/re-injected at merge; validation must let it through")
	})

	t.Run("shared_only select: held value passes, non-held rejected, token allowed", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}

		// "Alpha" is in the visible-options set (caller holds it)
		ok := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		require.Nil(t, a.validateConditionValues(rctx, ok, "groupID", fields))

		// "Charlie" is not in the visible-options set → rejected
		bad := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     "Charlie",
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, bad, "groupID", fields)
		require.NotNil(t, err)
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)

		// Masked-token sentinel passes through (handled by merge, not validation)
		tokenCond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     maskedTokenValue,
			ValueType: model.LiteralValue,
		}
		assert.Nil(t, a.validateConditionValues(rctx, tokenCond, "groupID", fields))
	})

	t.Run("source_only field rejects non-string literals (numeric, bool)", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSourceOnly, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     float64(1),
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", fields)
		require.NotNil(t, err, "numeric literal must not slip through extractStringValues silently")
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	})

	t.Run("shared_only field rejects non-string literals", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeSelect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "==",
			Value:     true,
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond, "groupID", fields)
		require.NotNil(t, err)
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	})

	t.Run("shared_only multiselect: array values are validated element by element", func(t *testing.T) {
		field := makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeMultiselect, selectOptions)
		fields := map[string]*model.PropertyField{"Team": field}

		allHeld, _ := json.Marshal([]any{"Alpha", "Bravo"})
		cond := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "in",
			Value:     parseAny(t, allHeld),
			ValueType: model.LiteralValue,
		}
		require.Nil(t, a.validateConditionValues(rctx, cond, "groupID", fields))

		mixed, _ := json.Marshal([]any{"Alpha", "Charlie"})
		cond2 := &model.Condition{
			Attribute: "user.attributes.Team",
			Operator:  "in",
			Value:     parseAny(t, mixed),
			ValueType: model.LiteralValue,
		}
		err := a.validateConditionValues(rctx, cond2, "groupID", fields)
		require.NotNil(t, err, "any non-held element must trigger rejection")
		assert.Equal(t, "app.pap.save_policy.invalid_value", err.Id)
	})
}

// parseAny round-trips a JSON-encoded value back to the untyped interface{}
// shape that the visual-AST parser produces for condition.Value.
func parseAny(t *testing.T, raw []byte) any {
	t.Helper()
	var v any
	require.NoError(t, json.Unmarshal(raw, &v))
	return v
}
