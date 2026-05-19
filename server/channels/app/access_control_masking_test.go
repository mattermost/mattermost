// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
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
