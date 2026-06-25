// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestExtractFieldName(t *testing.T) {
	tests := []struct {
		name      string
		attribute string
		expected  string
	}{
		{"standard attribute path", "user.attributes.Program", "Program"},
		{"multi-word field", "user.attributes.Clearance Level", "Clearance Level"},
		{"no prefix", "Program", ""},
		{"partial prefix", "user.attributes.", ""},
		{"empty string", "", ""},
		{"different prefix", "team.attributes.Program", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := extractFieldName(tc.attribute)
			assert.Equal(t, tc.expected, result)
		})
	}
}

// Note: tests for field.GetAccessMode() live in model/property_access_test.go,
// where the method is defined (TestPropertyFieldGetAccessMode).

func TestExtractVisibleOptionNames(t *testing.T) {
	t.Run("extracts names from valid options", func(t *testing.T) {
		field := &model.PropertyField{
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "id1", "name": "Alpha", "color": "red"},
					map[string]any{"id": "id2", "name": "Bravo", "color": "blue"},
				},
			},
		}

		names := extractVisibleOptionNames(field)
		assert.Len(t, names, 2)
		assert.Contains(t, names, "Alpha")
		assert.Contains(t, names, "Bravo")
	})

	t.Run("returns empty set for nil attrs", func(t *testing.T) {
		field := &model.PropertyField{Attrs: nil}
		names := extractVisibleOptionNames(field)
		assert.Empty(t, names)
	})

	t.Run("returns empty set for empty options", func(t *testing.T) {
		field := &model.PropertyField{
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{},
			},
		}
		names := extractVisibleOptionNames(field)
		assert.Empty(t, names)
	})

	t.Run("skips options without name field", func(t *testing.T) {
		field := &model.PropertyField{
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "id1", "name": "Alpha"},
					map[string]any{"id": "id2"}, // no name
				},
			},
		}
		names := extractVisibleOptionNames(field)
		assert.Len(t, names, 1)
		assert.Contains(t, names, "Alpha")
	})

	t.Run("skips empty name", func(t *testing.T) {
		field := &model.PropertyField{
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "id1", "name": ""},
				},
			},
		}
		names := extractVisibleOptionNames(field)
		assert.Empty(t, names)
	})
}

func TestFilterConditionValues(t *testing.T) {
	t.Run("multi-value: filters to visible only, sets HasMaskedValues", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Program",
			Operator:      "in",
			Value:         []any{"Alpha", "Bravo", "Charlie"},
			ValueType:     model.LiteralValue,
			AttributeType: "multiselect",
		}

		visibleNames := map[string]struct{}{"Alpha": {}}
		filterConditionValues(condition, visibleNames)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Equal(t, []any{"Alpha"}, values)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("multi-value: all visible, no masking", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Program",
			Operator:      "in",
			Value:         []any{"Alpha", "Bravo"},
			ValueType:     model.LiteralValue,
			AttributeType: "multiselect",
		}

		visibleNames := map[string]struct{}{"Alpha": {}, "Bravo": {}}
		filterConditionValues(condition, visibleNames)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Equal(t, []any{"Alpha", "Bravo"}, values)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("multi-value: none visible, all masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Program",
			Operator:      "in",
			Value:         []any{"Alpha", "Bravo"},
			ValueType:     model.LiteralValue,
			AttributeType: "multiselect",
		}

		visibleNames := map[string]struct{}{}
		filterConditionValues(condition, visibleNames)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Empty(t, values)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("single value: visible, no masking", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Location",
			Operator:      "==",
			Value:         "Building 1",
			ValueType:     model.LiteralValue,
			AttributeType: "select",
		}

		visibleNames := map[string]struct{}{"Building 1": {}}
		filterConditionValues(condition, visibleNames)

		assert.Equal(t, "Building 1", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("single value: not visible, masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Location",
			Operator:      "==",
			Value:         "Building 7",
			ValueType:     model.LiteralValue,
			AttributeType: "select",
		}

		visibleNames := map[string]struct{}{"Building 1": {}}
		filterConditionValues(condition, visibleNames)

		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("non-string value: skipped without masking", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Active",
			Operator:      "==",
			Value:         true,
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		visibleNames := map[string]struct{}{}
		filterConditionValues(condition, visibleNames)

		assert.Equal(t, true, condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("slice with non-string elements: non-strings excluded from masking count", func(t *testing.T) {
		// A []any with non-string elements should not trigger HasMaskedValues —
		// non-strings are not masking candidates, not masked values.
		condition := &model.Condition{
			Attribute:     "user.attributes.Program",
			Operator:      "in",
			Value:         []any{true, 42, "Alpha"},
			ValueType:     model.LiteralValue,
			AttributeType: "multiselect",
		}

		visibleNames := map[string]struct{}{"Alpha": {}}
		filterConditionValues(condition, visibleNames)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Equal(t, []any{"Alpha"}, values)
		assert.False(t, condition.HasMaskedValues) // only string "Alpha" counted; it's visible
	})

	t.Run("nil value: skipped", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Program",
			Operator:  "==",
			Value:     nil,
			ValueType: model.LiteralValue,
		}

		visibleNames := map[string]struct{}{}
		filterConditionValues(condition, visibleNames)

		assert.Nil(t, condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})
}

// TestAttrValueSkip_FilterConditionValuesNotCalled documents why the AttrValue early-return in
// maskConditionValues is necessary: without it, filterConditionValues would treat the attribute
// path string (e.g. "user.attributes.Department") as a literal value and mask it.
func TestAttrValueSkip_FilterConditionValuesNotCalled(t *testing.T) {
	condition := &model.Condition{
		Attribute: "user.attributes.Team",
		Operator:  "==",
		Value:     "user.attributes.Department", // attribute path, not a literal
		ValueType: model.AttrValue,
	}

	// If filterConditionValues were called on an AttrValue condition, it would
	// incorrectly mask the attribute path since it won't be in the visible set.
	filterConditionValues(condition, map[string]struct{}{})
	assert.Nil(t, condition.Value)
	assert.True(t, condition.HasMaskedValues)

	// This confirms maskConditionValues MUST return early for AttrValue before
	// reaching filterConditionValues. The early-return path in maskConditionValues
	// itself is not exercised here; this test only documents why that guard is required.
}

func TestFilterConditionValues_EmptySlice(t *testing.T) {
	condition := &model.Condition{
		Attribute:     "user.attributes.Program",
		Operator:      "in",
		Value:         []any{},
		ValueType:     model.LiteralValue,
		AttributeType: "multiselect",
	}

	visibleNames := map[string]struct{}{"Alpha": {}}
	filterConditionValues(condition, visibleNames)

	values, ok := condition.Value.([]any)
	require.True(t, ok)
	assert.Empty(t, values)
	assert.False(t, condition.HasMaskedValues) // nothing was filtered
}

func TestFilterConditionValues_TextFieldMasking(t *testing.T) {
	// Text field masking uses the same filterConditionValues function,
	// but the visible set comes from the caller's actual text value
	// instead of field options.

	t.Run("text field with in operator: caller holds matching value", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Clearance",
			Operator:      "in",
			Value:         []any{"Top Secret", "Secret", "Confidential"},
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		// Caller holds "Top Secret" — only this value should be visible
		callerTextValues := map[string]struct{}{"Top Secret": {}}
		filterConditionValues(condition, callerTextValues)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Equal(t, []any{"Top Secret"}, values)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("text field with in operator: caller holds no matching value", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Clearance",
			Operator:      "in",
			Value:         []any{"Top Secret", "Secret"},
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		// Caller holds "Unclassified" — none of the policy values match
		callerTextValues := map[string]struct{}{"Unclassified": {}}
		filterConditionValues(condition, callerTextValues)

		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Empty(t, values)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("text field with == operator: caller holds matching value", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Clearance",
			Operator:      "==",
			Value:         "Top Secret",
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		callerTextValues := map[string]struct{}{"Top Secret": {}}
		filterConditionValues(condition, callerTextValues)

		assert.Equal(t, "Top Secret", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("text field with == operator: caller holds different value", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Clearance",
			Operator:      "==",
			Value:         "Top Secret",
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		callerTextValues := map[string]struct{}{"Secret": {}}
		filterConditionValues(condition, callerTextValues)

		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("text field with is not operator: caller holds no value", func(t *testing.T) {
		condition := &model.Condition{
			Attribute:     "user.attributes.Location",
			Operator:      "!=",
			Value:         "Building 7",
			ValueType:     model.LiteralValue,
			AttributeType: "text",
		}

		// Caller has no value for Location — empty visible set
		callerTextValues := map[string]struct{}{}
		filterConditionValues(condition, callerTextValues)

		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})
}

func TestMaskConditionValues(t *testing.T) {
	rctx := request.TestContext(t)

	// nil App is safe for every branch that does not reach a.getCallerTextValues
	// (i.e., everything except shared_only + text field, which needs a real store).
	var a *App

	makeField := func(accessMode string, fieldType model.PropertyFieldType, options []any) *model.PropertyField {
		attrs := model.StringInterface{model.PropertyAttrsAccessMode: accessMode}
		if options != nil {
			attrs[model.PropertyFieldAttributeOptions] = options
		}
		return &model.PropertyField{Type: fieldType, Attrs: attrs}
	}

	options := []any{
		map[string]any{"id": "id1", "name": "Alpha"},
		map[string]any{"id": "id2", "name": "Bravo"},
	}

	t.Run("AttrValue condition: returns immediately, value untouched", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Team",
			Value:     "user.attributes.Department",
			ValueType: model.AttrValue,
		}
		a.maskConditionValues(rctx, "caller", condition, "", nil)
		assert.Equal(t, "user.attributes.Department", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("non-user-attribute path: returns immediately, value untouched", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "team.attributes.Program",
			Value:     "Engineering",
			ValueType: model.LiteralValue,
		}
		a.maskConditionValues(rctx, "caller", condition, "", map[string]*model.PropertyField{})
		assert.Equal(t, "Engineering", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("field missing from prefetch map: fail-closed", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Program",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		a.maskConditionValues(rctx, "caller", condition, "", map[string]*model.PropertyField{})
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("public field: value passes through unchanged", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Program",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Program": makeField(model.PropertyAccessModePublic, model.PropertyFieldTypeSelect, options),
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		assert.Equal(t, "Alpha", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("source_only field: value is nil'd and masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Clearance",
			Value:     "Top Secret",
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Clearance": makeField(model.PropertyAccessModeSourceOnly, model.PropertyFieldTypeSelect, options),
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("shared_only select: visible option kept, hidden option masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Location",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Location": makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeSelect, options),
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		// "Alpha" is in the field options so it is visible
		assert.Equal(t, "Alpha", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("shared_only select: value not in options is masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Location",
			Value:     "Charlie",
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Location": makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeSelect, options),
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("shared_only multiselect: visible values kept, hidden values masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Programs",
			Value:     []any{"Alpha", "Charlie"},
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Programs": makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeMultiselect, options),
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		values, ok := condition.Value.([]any)
		require.True(t, ok)
		assert.Equal(t, []any{"Alpha"}, values)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("unknown access mode: fail-closed", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes.Program",
			Value:     "Alpha",
			ValueType: model.LiteralValue,
		}
		fields := map[string]*model.PropertyField{
			"Program": {
				Type:  model.PropertyFieldTypeSelect,
				Attrs: model.StringInterface{model.PropertyAttrsAccessMode: "future_unknown_mode"},
			},
		}
		a.maskConditionValues(rctx, "caller", condition, "", fields)
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})
}

// TestMaskConditionValues_SharedOnlyText covers the shared_only + text-field branch of
// maskConditionValues, which requires a real store to call getCallerTextValues →
// SearchPropertyValues. This branch is intentionally skipped in TestMaskConditionValues
// (which uses a nil App).
//
// A non-CPA V1 group is used so that field creation does not go through the CPA
// access-control layer (which requires a plugin caller for protected/shared_only fields).
// The group ID is passed explicitly to maskConditionValues so store lookups use the same group.
func TestMaskConditionValues_SharedOnlyText(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := request.TestContext(t)
	callerID := model.NewId()

	// Register a plain V1 group — no access-control overhead for this group.
	group, appErr := th.App.RegisterPropertyGroup(rctx, &model.PropertyGroup{
		Name:    "masking_text_test_" + model.NewId(),
		Version: model.PropertyGroupVersionV1,
	})
	require.Nil(t, appErr)
	groupID := group.ID

	// Create a text field and set shared_only in its Attrs.
	// shared_only normally requires protected=true which is plugin-only in the CPA
	// group; in this non-CPA group the access-control layer is not applied, so the
	// field is written directly.
	field := &model.PropertyField{
		GroupID: groupID,
		Name:    "f_" + model.NewId(),
		Type:    model.PropertyFieldTypeText,
		Attrs:   model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly},
	}
	createdField, err := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, err)

	// Store "Engineering" as the caller's value for this field.
	_, appErr = th.App.CreatePropertyValue(rctx, &model.PropertyValue{
		TargetID:   callerID,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    createdField.ID,
		Value:      json.RawMessage(`"Engineering"`),
	})
	require.Nil(t, appErr)

	fieldsByName := map[string]*model.PropertyField{createdField.Name: createdField}

	t.Run("caller's own value passes through", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes." + createdField.Name,
			Value:     "Engineering",
			ValueType: model.LiteralValue,
		}
		th.App.maskConditionValues(rctx, callerID, condition, groupID, fieldsByName)
		assert.Equal(t, "Engineering", condition.Value)
		assert.False(t, condition.HasMaskedValues)
	})

	t.Run("value the caller does not hold is masked", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes." + createdField.Name,
			Value:     "Finance",
			ValueType: model.LiteralValue,
		}
		th.App.maskConditionValues(rctx, callerID, condition, groupID, fieldsByName)
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})

	t.Run("caller with no stored value is fail-closed", func(t *testing.T) {
		condition := &model.Condition{
			Attribute: "user.attributes." + createdField.Name,
			Value:     "Engineering",
			ValueType: model.LiteralValue,
		}
		th.App.maskConditionValues(rctx, model.NewId(), condition, groupID, fieldsByName)
		assert.Nil(t, condition.Value)
		assert.True(t, condition.HasMaskedValues)
	})
}

// TestGetMaskedVisualAST_Wiring validates the orchestration inside GetMaskedVisualAST:
// ExpressionToVisualAST is mocked while field lookup and value fetching hit the real store.
//
// The shared_only + text path requires a plugin-owned CPA field and is covered by
// TestMaskConditionValues_SharedOnlyText. This test focuses on:
//   - public field: value passes through unchanged (no masking)
//   - unknown field: fail-closed (field absent from prefetch map → nil + HasMaskedValues)
func TestGetMaskedVisualAST_Wiring(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)
	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)
	cpaID := cpaGroup.ID

	callerID := model.NewId()

	// Create a plain public text field in the CPA group (no access mode = public).
	// Non-protected fields are writable by any caller in the CPA group.
	fieldName := "f_" + model.NewId()
	field := &model.PropertyField{
		GroupID:    cpaID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}
	_, appErr := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, appErr)

	t.Run("public field value passes through unchanged", func(t *testing.T) {
		visualAST := &model.VisualExpression{
			Conditions: []model.Condition{
				{Attribute: "user.attributes." + fieldName, Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
			},
		}
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("ExpressionToVisualAST", mock.Anything, mock.Anything).Return(visualAST, nil).Once()

		result, err := th.App.GetMaskedVisualAST(rctx, "irrelevant", callerID)
		require.Nil(t, err)
		require.Len(t, result.Conditions, 1)
		assert.Equal(t, "Engineering", result.Conditions[0].Value)
		assert.False(t, result.Conditions[0].HasMaskedValues)
		mockACS.AssertExpectations(t)
	})

	t.Run("unknown field name fails closed", func(t *testing.T) {
		visualAST := &model.VisualExpression{
			Conditions: []model.Condition{
				{Attribute: "user.attributes.f_" + model.NewId(), Operator: "==", Value: "SomeValue", ValueType: model.LiteralValue},
			},
		}
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("ExpressionToVisualAST", mock.Anything, mock.Anything).Return(visualAST, nil).Once()

		result, err := th.App.GetMaskedVisualAST(rctx, "irrelevant", callerID)
		require.Nil(t, err)
		require.Len(t, result.Conditions, 1)
		// Field absent from prefetch map → fail-closed
		assert.Nil(t, result.Conditions[0].Value)
		assert.True(t, result.Conditions[0].HasMaskedValues)
		mockACS.AssertExpectations(t)
	})
}

// TestJoinChildExpressions covers the compound-rebuild helper that
// keeps OR / AND / NOT structure intact when
// maskSimulationEvaluationTree walks a compound node bottom-up. The
// helper is pure (no DB / context); these are table-style tests that
// pin the paren wrapping and the dropped-empty-child behavior so a
// future refactor can't silently change either invariant.
func TestJoinChildExpressions(t *testing.T) {
	mkChild := func(expr string) model.PolicySimulationEvaluationNode {
		return model.PolicySimulationEvaluationNode{Expression: expr}
	}

	t.Run("no children returns empty", func(t *testing.T) {
		assert.Equal(t, "", joinChildExpressions(nil, "&&"))
		assert.Equal(t, "", joinChildExpressions([]model.PolicySimulationEvaluationNode{}, "&&"))
	})

	t.Run("single child wrapped in parens", func(t *testing.T) {
		result := joinChildExpressions([]model.PolicySimulationEvaluationNode{mkChild(`user.attributes.x == "a"`)}, "&&")
		assert.Equal(t, `(user.attributes.x == "a")`, result)
	})

	t.Run("multiple children joined with operator", func(t *testing.T) {
		children := []model.PolicySimulationEvaluationNode{
			mkChild(`user.attributes.x == "a"`),
			mkChild(`user.attributes.y == "b"`),
		}
		assert.Equal(t, `(user.attributes.x == "a") && (user.attributes.y == "b")`, joinChildExpressions(children, "&&"))
		assert.Equal(t, `(user.attributes.x == "a") || (user.attributes.y == "b")`, joinChildExpressions(children, "||"))
	})

	t.Run("empty children dropped so parent has no dangling operator", func(t *testing.T) {
		// A child whose leaf masking failed-closed has Expression="";
		// the parent must skip it rather than emit "() && (real)" or
		// a trailing " && ". Either of those would be invalid CEL and
		// would surface to the picker.
		children := []model.PolicySimulationEvaluationNode{
			mkChild(""),
			mkChild(`user.attributes.x == "a"`),
			mkChild(""),
		}
		assert.Equal(t, `(user.attributes.x == "a")`, joinChildExpressions(children, "&&"))
	})

	t.Run("all children empty returns empty", func(t *testing.T) {
		children := []model.PolicySimulationEvaluationNode{mkChild(""), mkChild("")}
		assert.Equal(t, "", joinChildExpressions(children, "||"))
	})
}

// TestClearEvaluationTreeLiterals pins the fail-closed walker: every
// node's Expression must be wiped and every non-empty ExpectedValue
// must collapse to the masked-token sentinel. The walker is invoked
// from the top-level CPA-group-fetch failure path, so a regression
// here would leak literal values back to the caller through the
// simulator response.
func TestClearEvaluationTreeLiterals(t *testing.T) {
	t.Run("nil node is a no-op", func(t *testing.T) {
		clearEvaluationTreeLiterals(nil) // must not panic
	})

	t.Run("leaf with literal: expression cleared, expected and actual sentinel", func(t *testing.T) {
		node := &model.PolicySimulationEvaluationNode{
			Kind:          model.PolicySimulationEvaluationKindCompare,
			Expression:    `user.attributes.x == "secret"`,
			ExpectedValue: "secret",
			ActualValue:   "secret",
		}
		clearEvaluationTreeLiterals(node)
		assert.Equal(t, "", node.Expression)
		assert.Equal(t, maskedTokenValue, node.ExpectedValue)
		assert.Equal(t, maskedTokenValue, node.ActualValue,
			"fail-closed must also collapse the simulated user's value — it's just as much a literal as the rule's")
	})

	t.Run("leaf with empty expected/actual: stays empty (no sentinel invented)", func(t *testing.T) {
		// A leaf with no recorded literal (e.g. an attribute-vs-
		// attribute compare) must NOT have ExpectedValue or
		// ActualValue forced to the sentinel — that would invent
		// values where the simulator deliberately omitted them.
		node := &model.PolicySimulationEvaluationNode{
			Kind:       model.PolicySimulationEvaluationKindCompare,
			Expression: `user.attributes.x == user.attributes.y`,
		}
		clearEvaluationTreeLiterals(node)
		assert.Equal(t, "", node.Expression)
		assert.Equal(t, "", node.ExpectedValue)
		assert.Equal(t, "", node.ActualValue)
	})

	t.Run("compound node recurses into children", func(t *testing.T) {
		root := &model.PolicySimulationEvaluationNode{
			Kind:       model.PolicySimulationEvaluationKindAnd,
			Expression: `(user.attributes.x == "a") && (user.attributes.y == "b")`,
			Children: []model.PolicySimulationEvaluationNode{
				{Kind: model.PolicySimulationEvaluationKindCompare, Expression: `user.attributes.x == "a"`, ExpectedValue: "a", ActualValue: "a"},
				{Kind: model.PolicySimulationEvaluationKindCompare, Expression: `user.attributes.y == "b"`, ExpectedValue: "b", ActualValue: "z"},
			},
		}
		clearEvaluationTreeLiterals(root)
		assert.Equal(t, "", root.Expression)
		assert.Equal(t, "", root.Children[0].Expression)
		assert.Equal(t, maskedTokenValue, root.Children[0].ExpectedValue)
		assert.Equal(t, maskedTokenValue, root.Children[0].ActualValue)
		assert.Equal(t, "", root.Children[1].Expression)
		assert.Equal(t, maskedTokenValue, root.Children[1].ExpectedValue)
		assert.Equal(t, maskedTokenValue, root.Children[1].ActualValue)
	})
}

// TestMaskSimulationPolicyLiteralsForCaller_FlagOff and
// _GuardClauses pin the entry-point branches that short-circuit
// without touching the response. Together they prove the function
// is safe to call from the simulate handler regardless of feature-
// flag or input state, so the wiring in
// SimulateAccessControlPolicyForUsers doesn't need to add its own
// gates.
func TestMaskSimulationPolicyLiteralsForCaller_FlagOff(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)
	rctx := request.TestContext(t)

	resp := &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			Decisions: map[string]model.PolicySimulationActionDecision{
				"view_channel": {
					Blame: []model.PolicySimulationBlame{{
						RuleName:   "rule1",
						Expression: `user.attributes.x == "kept-as-is"`,
						EvaluationTree: &model.PolicySimulationEvaluationNode{
							Kind:          model.PolicySimulationEvaluationKindCompare,
							Expression:    `user.attributes.x == "kept-as-is"`,
							ExpectedValue: "kept-as-is",
						},
					}},
				},
			},
		}},
	}

	th.App.MaskSimulationPolicyLiteralsForCaller(rctx, resp, model.NewId())

	blame := resp.Results[0].Decisions["view_channel"].Blame[0]
	assert.Equal(t, `user.attributes.x == "kept-as-is"`, blame.Expression, "flag off must skip masking entirely")
	assert.Equal(t, "kept-as-is", blame.EvaluationTree.ExpectedValue, "flag off must skip masking entirely")
}

func TestMaskSimulationPolicyLiteralsForCaller_GuardClauses(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	rctx := request.TestContext(t)

	t.Run("nil response is a no-op", func(t *testing.T) {
		// Must not panic and must not touch anything (there's nothing
		// to touch). Pinned because the api4 handler dereferences
		// resp.Results immediately after this call.
		th.App.MaskSimulationPolicyLiteralsForCaller(rctx, nil, model.NewId())
	})

	t.Run("empty callerID is a no-op", func(t *testing.T) {
		// The API layer rejects empty callerID before reaching this function.
		// Pinned to ensure MaskSimulationPolicyLiteralsForCaller is safe to call
		// with an empty callerID (no panic, no masking applied).
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				Decisions: map[string]model.PolicySimulationActionDecision{
					"view_channel": {
						Blame: []model.PolicySimulationBlame{{
							Expression: `user.attributes.x == "kept"`,
						}},
					},
				},
			}},
		}
		th.App.MaskSimulationPolicyLiteralsForCaller(rctx, resp, "")
		assert.Equal(t, `user.attributes.x == "kept"`, resp.Results[0].Decisions["view_channel"].Blame[0].Expression)
	})
}

// TestMaskSimulationPolicyLiteralsForCaller_SourceOnly is the end-
// to-end test for the new pass: a real source_only CPA field
// (inserted directly via the store because the App's
// CreatePropertyField hook rejects non-plugin callers from setting
// protected/source_plugin_id) drives the masker against a simulator
// response shaped like the picker output. We mock MaskExpressionForCaller
// — the rest of the masking pipeline (field lookup, simulation tree
// walk, expression backfill) is the real one, because that's the
// layer this test is pinning. Every
// literal-bearing surface (Blame.Expression, the leaf evaluation
// tree's Expression and ExpectedValue, MergedRule.Expression, and
// the merged-rule subtree) must collapse to the "--------" sentinel
// for a caller who isn't the source plugin, regardless of role.
func TestMaskSimulationPolicyLiteralsForCaller_SourceOnly(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)
	rctx := request.TestContext(t)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	fieldName := celSafeName()
	_, sErr := th.Store.PropertyField().Create(&model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsSourcePluginID: "com.mattermost.uas-plugin",
		},
	})
	require.NoError(t, sErr)

	// Mock MaskExpressionForCaller to return the sentinel for source_only values.
	// Tests run without a real PAP wired up; the canonical walker is exercised by
	// cel_utils/masking_test.go — here we pin the app-layer wiring end-to-end.
	leafExpr := `user.attributes.` + fieldName + ` == "Crimsone One"`
	maskedExpr := `user.attributes.` + fieldName + ` == "` + maskedTokenValue + `"`
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("MaskExpressionForCaller", mock.Anything, mock.Anything, mock.Anything).
		Return(maskedExpr, true, nil)
	resp := &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			User: &model.User{Id: model.NewId()},
			Decisions: map[string]model.PolicySimulationActionDecision{
				"upload_file_attachment": {
					Decision: false,
					Blame: []model.PolicySimulationBlame{{
						Source:     model.PolicySimulationBlameSourceThisRule,
						RuleName:   "rule1",
						Expression: leafExpr,
						EvaluationTree: &model.PolicySimulationEvaluationNode{
							Kind:          model.PolicySimulationEvaluationKindCompare,
							Expression:    leafExpr,
							ExpectedValue: "Crimsone One",
							ActualValue:   "Crimsone One",
							Outcome:       model.PolicySimulationEvaluationOutcomeFalse,
							Attribute:     "user.attributes." + fieldName,
						},
						MergedRules: []model.PolicySimulationMergedRule{{
							Name:       "rule1",
							Expression: leafExpr,
							EvaluationTree: &model.PolicySimulationEvaluationNode{
								Kind:          model.PolicySimulationEvaluationKindCompare,
								Expression:    leafExpr,
								ExpectedValue: "Crimsone One",
								ActualValue:   "Crimsone One",
								Outcome:       model.PolicySimulationEvaluationOutcomeFalse,
								Attribute:     "user.attributes." + fieldName,
							},
						}},
					}},
				},
			},
		}},
	}

	th.App.MaskSimulationPolicyLiteralsForCaller(rctx, resp, model.NewId())

	blame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]

	// Top-level Blame.Expression is re-sourced from the (also-masked)
	// evaluation tree root so the OR / NOT shape survives. For a
	// single-leaf rule the rebuilt text IS the masked leaf form.
	assert.Contains(t, blame.Expression, maskedTokenValue,
		"Blame.Expression must carry the masked sentinel for source_only literals")
	assert.NotContains(t, blame.Expression, "Crimsone One",
		"Blame.Expression must not leak the source_only literal back to the caller")

	// Evaluation tree leaf — every surface (Expression, the
	// rule-literal ExpectedValue, AND the simulated user's
	// ActualValue) must reflect the mask. ActualValue is the user-
	// data twin of ExpectedValue: source_only means "nobody but the
	// source plugin sees ANY value", so the user's recorded value
	// is just as sensitive as the rule literal.
	require.NotNil(t, blame.EvaluationTree)
	assert.Contains(t, blame.EvaluationTree.Expression, maskedTokenValue)
	assert.NotContains(t, blame.EvaluationTree.Expression, "Crimsone One")
	assert.Equal(t, maskedTokenValue, blame.EvaluationTree.ExpectedValue,
		"leaf ExpectedValue must collapse to the sentinel when the field is source_only")
	assert.Equal(t, maskedTokenValue, blame.EvaluationTree.ActualValue,
		"leaf ActualValue must collapse to the sentinel when the field is source_only — the picker's 'Actual: X' line is a leak path otherwise")

	// MergedRule surfaces are independent of the top-level Blame —
	// the picker renders them in a separate "combined evaluation"
	// section, so a leak on either path is equally bad.
	require.Len(t, blame.MergedRules, 1)
	m := blame.MergedRules[0]
	assert.Contains(t, m.Expression, maskedTokenValue)
	assert.NotContains(t, m.Expression, "Crimsone One")
	require.NotNil(t, m.EvaluationTree)
	assert.Contains(t, m.EvaluationTree.Expression, maskedTokenValue)
	assert.Equal(t, maskedTokenValue, m.EvaluationTree.ExpectedValue)
	assert.Equal(t, maskedTokenValue, m.EvaluationTree.ActualValue)
	mockACS.AssertExpectations(t)
}

// TestMaskSimulationPolicyLiteralsForCaller_PublicFieldPassesThrough
// proves the masker doesn't over-mask: a plain public CPA field's
// literal value stays visible end-to-end on every surface. Without
// this pin a future refactor could accidentally fail-close on every
// field by treating an empty access_mode as "non-public", silently
// blanking the picker.
func TestMaskSimulationPolicyLiteralsForCaller_PublicFieldPassesThrough(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)
	rctx := request.TestContext(t)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	fieldName := celSafeName()
	_, vAppErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, vAppErr)

	expr := `user.attributes.` + fieldName + ` == "Engineering"`
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("MaskExpressionForCaller", mock.Anything, mock.Anything, mock.Anything).
		Return(expr, false, nil)
	resp := &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			Decisions: map[string]model.PolicySimulationActionDecision{
				"view_channel": {
					Blame: []model.PolicySimulationBlame{{
						RuleName:   "rule1",
						Expression: expr,
						EvaluationTree: &model.PolicySimulationEvaluationNode{
							Kind:          model.PolicySimulationEvaluationKindCompare,
							Expression:    expr,
							ExpectedValue: "Engineering",
							ActualValue:   "Sales",
							Attribute:     "user.attributes." + fieldName,
						},
					}},
				},
			},
		}},
	}

	th.App.MaskSimulationPolicyLiteralsForCaller(rctx, resp, model.NewId())

	blame := resp.Results[0].Decisions["view_channel"].Blame[0]
	assert.Contains(t, blame.Expression, "Engineering",
		"public field literal must pass through unchanged at the top level")
	assert.Equal(t, "Engineering", blame.EvaluationTree.ExpectedValue,
		"public field leaf ExpectedValue must pass through unchanged")
	assert.Equal(t, "Sales", blame.EvaluationTree.ActualValue,
		"public field leaf ActualValue must pass through unchanged")
	assert.NotContains(t, blame.EvaluationTree.Expression, maskedTokenValue,
		"public field leaf Expression must not gain a sentinel")
	mockACS.AssertExpectations(t)
}

// TestMaskSimulationPolicyLiteralsForCaller_ActualValueIndependentFromExpected
// pins the most subtle correctness invariant: ExpectedValue and
// ActualValue are checked against the caller's holdings
// independently. For a shared_only text field where the caller
// holds value "A", the rule literal "A" stays visible but a
// simulated user's actual value "B" must mask — because the caller
// is allowed to see "A" (they hold it) but not "B" (they don't).
// Without this pin a regression that masks both values together
// (or neither together) would still pass the source_only and
// public tests but silently leak per-value AVM semantics for the
// shared_only path.
//
// Uses a non-CPA V1 property group for the same reason
// TestMaskConditionValues_SharedOnlyText does: shared_only on the
// CPA group requires a plugin caller for field creation /
// value-write, which is unrelated to what we're pinning here.
func TestMaskSimulationPolicyLiteralsForCaller_ActualValueIndependentFromExpected(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)
	rctx := request.TestContext(t)
	callerID := model.NewId()

	group, gAppErr := th.App.RegisterPropertyGroup(rctx, &model.PropertyGroup{
		Name:    "sim_mask_actual_test_" + model.NewId(),
		Version: model.PropertyGroupVersionV1,
	})
	require.Nil(t, gAppErr)
	groupID := group.ID

	field := &model.PropertyField{
		GroupID: groupID,
		Name:    "f_" + model.NewId(),
		Type:    model.PropertyFieldTypeText,
		Attrs:   model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly},
	}
	createdField, vAppErr := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, vAppErr)

	// Caller holds "A" — that's the rule literal we want to keep
	// visible. They do NOT hold "B" — that's the simulated user's
	// value that must mask independently.
	_, vAppErr = th.App.CreatePropertyValue(rctx, &model.PropertyValue{
		TargetID:   callerID,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    createdField.ID,
		Value:      json.RawMessage(`"A"`),
	})
	require.Nil(t, vAppErr)

	// The simulator pass uses GetPropertyGroup(AccessControlPropertyGroupName)
	// to derive the cpaGroupID for its mask context, but the helpers
	// we exercise (callerCanSeeFieldValue / maskExpressionWithCache)
	// look fields up by name through GetPropertyFieldByName, which
	// is group-id-scoped. To make the test drive against our V1
	// group we bypass the public entry point and call the
	// per-decision helper directly with a mask context built around
	// the V1 group. This is the same shortcut existing shared_only
	// tests take.
	mcResolver, resolverErr := newMaskingResolver(th.App, rctx, callerID)
	require.Nil(t, resolverErr)
	mc := &simulationMaskContext{
		cpaGroupID:     groupID,
		rctxWithCaller: RequestContextWithCallerID(rctx, callerID),
		callerID:       callerID,
		resolver:       mcResolver,
	}

	// Mock MaskExpressionForCaller to return the original expression: caller holds "A"
	// so no literal is hidden, the expression passes through unchanged.
	leafExpr := `user.attributes.` + createdField.Name + ` == "A"`
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("MaskExpressionForCaller", mock.Anything, mock.Anything, mock.Anything).
		Return(leafExpr, false, nil)
	dec := &model.PolicySimulationActionDecision{
		Blame: []model.PolicySimulationBlame{{
			RuleName:   "rule1",
			Expression: leafExpr,
			EvaluationTree: &model.PolicySimulationEvaluationNode{
				Kind:          model.PolicySimulationEvaluationKindCompare,
				Expression:    leafExpr,
				ExpectedValue: "A",
				ActualValue:   "B",
				Attribute:     "user.attributes." + createdField.Name,
				Outcome:       model.PolicySimulationEvaluationOutcomeFalse,
			},
		}},
	}

	th.App.maskSimulationDecisionLiterals(dec, mc)

	leaf := dec.Blame[0].EvaluationTree
	require.NotNil(t, leaf)

	// Rule literal "A" is in the caller's held values, so
	// ExpectedValue passes through and the leaf Expression stays
	// unmasked.
	assert.Equal(t, "A", leaf.ExpectedValue,
		"shared_only ExpectedValue the caller holds must pass through unchanged")
	assert.NotContains(t, leaf.Expression, maskedTokenValue,
		"shared_only Expression whose literal the caller holds must stay unmasked")

	// Simulated user's value "B" is NOT in the caller's held values,
	// so it must mask independently — same field, same access mode,
	// different value.
	assert.Equal(t, maskedTokenValue, leaf.ActualValue,
		"shared_only ActualValue the caller doesn't hold must mask, even when ExpectedValue is visible")
	mockACS.AssertExpectations(t)
}

// TestMaskSimulationPolicyLiteralsForCaller_CompoundOrPreserved
// guards the boolean shape of the response. The simulation tree
// walker reconstructs compound nodes bottom-up from already-masked
// leaves, so OR / NOT structure must survive masking. This test seeds
// a two-leaf OR tree against a source_only field, runs the masker,
// and asserts the rebuilt compound still says "||". Without this pin
// a regression would mask the literals correctly but misrepresent the
// rule's logic to the picker.
func TestMaskSimulationPolicyLiteralsForCaller_CompoundOrPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)
	rctx := request.TestContext(t)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	fieldName := celSafeName()
	_, sErr := th.Store.PropertyField().Create(&model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsSourcePluginID: "com.mattermost.uas-plugin",
		},
	})
	require.NoError(t, sErr)

	// Each leaf is masked through MaskExpressionForCaller independently.
	// Both are source_only so both return the sentinel; we don't care about
	// call order — the assertion is on the rebuilt compound preserving "||".
	maskedLeaf := `user.attributes.` + fieldName + ` == "` + maskedTokenValue + `"`
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("MaskExpressionForCaller", mock.Anything, mock.MatchedBy(func(expr string) bool {
		return strings.Contains(expr, "Alpha")
	}), mock.Anything).Return(maskedLeaf, true, nil)
	mockACS.On("MaskExpressionForCaller", mock.Anything, mock.MatchedBy(func(expr string) bool {
		return strings.Contains(expr, "Bravo")
	}), mock.Anything).Return(maskedLeaf, true, nil)

	mkLeaf := func(value string) model.PolicySimulationEvaluationNode {
		return model.PolicySimulationEvaluationNode{
			Kind:          model.PolicySimulationEvaluationKindCompare,
			Expression:    `user.attributes.` + fieldName + ` == "` + value + `"`,
			ExpectedValue: value,
			Attribute:     "user.attributes." + fieldName,
		}
	}
	resp := &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			Decisions: map[string]model.PolicySimulationActionDecision{
				"view_channel": {
					Blame: []model.PolicySimulationBlame{{
						RuleName:   "rule1",
						Expression: `(user.attributes.` + fieldName + ` == "Alpha") || (user.attributes.` + fieldName + ` == "Bravo")`,
						EvaluationTree: &model.PolicySimulationEvaluationNode{
							Kind: model.PolicySimulationEvaluationKindOr,
							Children: []model.PolicySimulationEvaluationNode{
								mkLeaf("Alpha"),
								mkLeaf("Bravo"),
							},
						},
					}},
				},
			},
		}},
	}

	th.App.MaskSimulationPolicyLiteralsForCaller(rctx, resp, model.NewId())

	blame := resp.Results[0].Decisions["view_channel"].Blame[0]
	require.NotNil(t, blame.EvaluationTree)
	assert.Contains(t, blame.EvaluationTree.Expression, "||",
		"OR structure must survive masking — collapsing to AND would misrepresent the rule")
	assert.NotContains(t, blame.EvaluationTree.Expression, "Alpha")
	assert.NotContains(t, blame.EvaluationTree.Expression, "Bravo")

	// Top-level Blame.Expression is backfilled from the (masked)
	// tree root, so it must inherit the same preserved structure
	// and the same absence of literal leaks.
	assert.Equal(t, blame.EvaluationTree.Expression, blame.Expression)
	mockACS.AssertExpectations(t)
}
