// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildCELFromConditions(t *testing.T) {
	t.Run("empty conditions returns true", func(t *testing.T) {
		result := buildCELFromConditions(nil)
		assert.Equal(t, "true", result)
	})

	t.Run("equals operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Engineering"`, result)
	})

	t.Run("not equals operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Location", Operator: "!=", Value: "Building 7", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Location != "Building 7"`, result)
	})

	t.Run("in operator with select field", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Department",
				Operator:      "in",
				Value:         []any{"Sales", "Engineering", "Legal"},
				ValueType:     model.LiteralValue,
				AttributeType: "select",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Department in ["Sales", "Engineering", "Legal"]`, result)
	})

	t.Run("in operator with multiselect field", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "in",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs && "Bravo" in user.attributes.Programs`, result)
	})

	t.Run("hasAnyOf operator", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAnyOf",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `("Alpha" in user.attributes.Programs || "Bravo" in user.attributes.Programs)`, result)
	})

	t.Run("hasAnyOf with single value omits parens", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAnyOf",
				Value:         []any{"Alpha"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs`, result)
	})

	t.Run("hasAllOf operator", func(t *testing.T) {
		conditions := []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAllOf",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `"Alpha" in user.attributes.Programs && "Bravo" in user.attributes.Programs`, result)
	})

	t.Run("contains operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Email", Operator: "contains", Value: "@company.com", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Email.contains("@company.com")`, result)
	})

	t.Run("startsWith operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Name", Operator: "startsWith", Value: "Dr.", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Name.startsWith("Dr.")`, result)
	})

	t.Run("endsWith operator", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Email", Operator: "endsWith", Value: ".gov", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Email.endsWith(".gov")`, result)
	})

	t.Run("multiple conditions joined with &&", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.Location", Operator: "!=", Value: "Remote", ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Engineering" && user.attributes.Location != "Remote"`, result)
	})

	t.Run("string with special characters is escaped", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Team", Operator: "==", Value: `Team "Alpha"`, ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Team == "Team \"Alpha\""`, result)
	})

	t.Run("boolean value", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Active", Operator: "==", Value: true, ValueType: model.LiteralValue},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, `user.attributes.Active == true`, result)
	})

	t.Run("empty in-list produces no output", func(t *testing.T) {
		conditions := []model.Condition{
			{Attribute: "user.attributes.Department", Operator: "in", Value: []any{}, ValueType: model.LiteralValue, AttributeType: "select"},
		}
		result := buildCELFromConditions(conditions)
		assert.Equal(t, "true", result)
	})

	t.Run("masked token in values produces valid CEL", func(t *testing.T) {
		conds := []model.Condition{{
			Attribute:     "user.attributes.Program",
			Operator:      "in",
			Value:         []any{"Alpha", maskedTokenValue},
			ValueType:     model.LiteralValue,
			AttributeType: "select",
		}}
		result := buildCELFromConditions(conds)
		assert.Contains(t, result, "Alpha")
		assert.Contains(t, result, maskedTokenValue)
	})
}

func TestNormalizeForComparison(t *testing.T) {
	t.Run("strips whitespace outside string literals", func(t *testing.T) {
		got, ok := normalizeForComparison(` a   ==  "b"  `)
		require.True(t, ok)
		assert.Equal(t, `a=="b"`, got)
	})

	t.Run("preserves whitespace inside string literals", func(t *testing.T) {
		got, ok := normalizeForComparison(`a == "hello world"`)
		require.True(t, ok)
		assert.Equal(t, `a=="hello world"`, got)
	})

	t.Run("canonicalizes single quotes to double quotes", func(t *testing.T) {
		single, ok := normalizeForComparison(`a == 'foo'`)
		require.True(t, ok)
		double, ok := normalizeForComparison(`a == "foo"`)
		require.True(t, ok)
		assert.Equal(t, single, double)
	})

	t.Run("preserves escape sequences inside string literals", func(t *testing.T) {
		got, ok := normalizeForComparison(`a == "he said \"hi\""`)
		require.True(t, ok)
		assert.Equal(t, `a=="he said \"hi\""`, got)
	})

	t.Run("unbalanced quote returns ok=false", func(t *testing.T) {
		_, ok := normalizeForComparison(`a == "unterminated`)
		assert.False(t, ok)
	})

	t.Run("empty string normalizes to empty", func(t *testing.T) {
		got, ok := normalizeForComparison("")
		require.True(t, ok)
		assert.Equal(t, "", got)
	})
}

func TestIsVisualASTRepresentable(t *testing.T) {
	t.Run("empty AST on empty expression is representable", func(t *testing.T) {
		assert.True(t, isVisualASTRepresentable("", &model.VisualExpression{}))
	})

	t.Run("empty AST on 'true' is representable", func(t *testing.T) {
		assert.True(t, isVisualASTRepresentable("true", &model.VisualExpression{}))
	})

	t.Run("simple equals condition round-trips cleanly", func(t *testing.T) {
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
		}}
		assert.True(t, isVisualASTRepresentable(`user.attributes.team == "Engineering"`, ast))
	})

	t.Run("simple AND chain of two conditions round-trips cleanly", func(t *testing.T) {
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.team", Operator: "==", Value: "Engineering", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.role", Operator: "==", Value: "Admin", ValueType: model.LiteralValue},
		}}
		assert.True(t, isVisualASTRepresentable(
			`user.attributes.team == "Engineering" && user.attributes.role == "Admin"`,
			ast,
		))
	})

	t.Run("|| in original but AST flattens to AND is NOT representable", func(t *testing.T) {
		// Pretend the parser flattened `a == "X" || b == "Y"` into two AND-joined
		// conditions. The round-trip would emit `&&`, mismatch detected.
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.team", Operator: "==", Value: "X", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.role", Operator: "==", Value: "Y", ValueType: model.LiteralValue},
		}}
		assert.False(t, isVisualASTRepresentable(
			`user.attributes.team == "X" || user.attributes.role == "Y"`,
			ast,
		))
	})

	t.Run("grouping in original is NOT representable when AST flattens it", func(t *testing.T) {
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.a", Operator: "==", Value: "1", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.b", Operator: "==", Value: "2", ValueType: model.LiteralValue},
			{Attribute: "user.attributes.c", Operator: "==", Value: "3", ValueType: model.LiteralValue},
		}}
		assert.False(t, isVisualASTRepresentable(
			`(user.attributes.a == "1" && user.attributes.b == "2") || user.attributes.c == "3"`,
			ast,
		))
	})

	t.Run("hasAnyOf with multiple values is representable (|| within a single condition)", func(t *testing.T) {
		// `("Alpha" in attr || "Bravo" in attr)` is the canonical serialization
		// for a hasAnyOf condition. It contains || syntactically but the AST
		// reduces it to one condition that round-trips identically.
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{
				Attribute:     "user.attributes.Programs",
				Operator:      "hasAnyOf",
				Value:         []any{"Alpha", "Bravo"},
				ValueType:     model.LiteralValue,
				AttributeType: "multiselect",
			},
		}}
		assert.True(t, isVisualASTRepresentable(
			`("Alpha" in user.attributes.Programs || "Bravo" in user.attributes.Programs)`,
			ast,
		))
	})

	t.Run("unbalanced quote in original is NOT representable", func(t *testing.T) {
		ast := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.team", Operator: "==", Value: "X", ValueType: model.LiteralValue},
		}}
		assert.False(t, isVisualASTRepresentable(`user.attributes.team == "unterminated`, ast))
	})
}

func TestExtractStringValues(t *testing.T) {
	t.Run("slice of strings", func(t *testing.T) {
		result := extractStringValues([]any{"Alpha", "Bravo", "Charlie"})
		assert.Equal(t, []string{"Alpha", "Bravo", "Charlie"}, result)
	})

	t.Run("single string", func(t *testing.T) {
		result := extractStringValues("Alpha")
		assert.Equal(t, []string{"Alpha"}, result)
	})

	t.Run("nil", func(t *testing.T) {
		result := extractStringValues(nil)
		assert.Nil(t, result)
	})

	t.Run("mixed types in slice", func(t *testing.T) {
		result := extractStringValues([]any{"Alpha", 42, "Bravo"})
		assert.Equal(t, []string{"Alpha", "Bravo"}, result)
	})

	t.Run("non-string non-slice", func(t *testing.T) {
		result := extractStringValues(42)
		assert.Nil(t, result)
	})
}

func TestCelStringLiteral(t *testing.T) {
	assert.Equal(t, `"hello"`, celStringLiteral("hello"))
	assert.Equal(t, `"hello \"world\""`, celStringLiteral(`hello "world"`))
	assert.Equal(t, `"path\\to\\file"`, celStringLiteral(`path\to\file`))
	assert.Equal(t, `""`, celStringLiteral(""))

	// Control characters must be escaped or the emitted CEL literal won't parse.
	assert.Equal(t, `"line1\nline2"`, celStringLiteral("line1\nline2"))
	assert.Equal(t, `"col1\tcol2"`, celStringLiteral("col1\tcol2"))
	assert.Equal(t, `"carriage\rreturn"`, celStringLiteral("carriage\rreturn"))
}

func TestCelValueLiteral(t *testing.T) {
	assert.Equal(t, `"hello"`, celValueLiteral("hello"))
	assert.Equal(t, "true", celValueLiteral(true))
	assert.Equal(t, "false", celValueLiteral(false))
	assert.Equal(t, "42", celValueLiteral(int(42)))
	assert.Equal(t, "42", celValueLiteral(int64(42)))
	assert.Equal(t, "3.14", celValueLiteral(float64(3.14)))
	assert.Equal(t, "null", celValueLiteral(nil))

	// Float precision must round-trip — %f would round 0.123456789 to 0.123457.
	assert.Equal(t, "0.123456789", celValueLiteral(float64(0.123456789)))
}

func TestContainsNonStringLiteral(t *testing.T) {
	assert.False(t, containsNonStringLiteral(nil))
	assert.False(t, containsNonStringLiteral("Alpha"))
	assert.False(t, containsNonStringLiteral([]any{"Alpha", "Bravo"}))

	assert.True(t, containsNonStringLiteral(float64(1)))
	assert.True(t, containsNonStringLiteral(true))
	assert.True(t, containsNonStringLiteral(int64(7)))
	assert.True(t, containsNonStringLiteral([]any{"Alpha", 1.0}))
}

func TestConditionToCEL_NilValue(t *testing.T) {
	// A condition whose Value was masked to nil (e.g. all options hidden) must be dropped
	// rather than emitting `attr == null`, which is invalid CEL for string attributes.
	nilValueOps := []string{"==", "!=", ">", ">=", "<", "<=", "contains", "startsWith", "endsWith", "unknownOp"}
	for _, op := range nilValueOps {
		cond := model.Condition{
			Attribute: "user.attributes.Clearance",
			Operator:  op,
			Value:     nil,
			ValueType: model.LiteralValue,
		}
		assert.Equal(t, "", conditionToCEL(cond), "operator %q with nil value must produce empty string", op)
	}
}

func TestConditionToCEL_UnknownOperatorWithValue(t *testing.T) {
	// An unknown operator with a non-nil value produces a best-effort CEL expression.
	// buildCELFromConditions will include it as-is; if the operator is truly unknown
	// the downstream CEL engine will reject the expression during validation.
	// This documents the intended (pass-through) behaviour for forward-compatibility.
	cond := model.Condition{
		Attribute: "user.attributes.Clearance",
		Operator:  "futureOp",
		Value:     "Secret",
		ValueType: model.LiteralValue,
	}
	result := conditionToCEL(cond)
	assert.Equal(t, `user.attributes.Clearance futureOp "Secret"`, result)
}

func TestMergeConditionValues(t *testing.T) {
	t.Run("no hidden values returns submitted as-is", func(t *testing.T) {
		submitted := model.Condition{Attribute: "user.attributes.Program", Operator: "in", Value: []any{"Alpha"}}
		result := mergeConditionValues(submitted, nil)
		assert.Equal(t, []any{"Alpha"}, result.Value)
	})

	t.Run("appends hidden values without duplicates", func(t *testing.T) {
		submitted := model.Condition{Attribute: "user.attributes.Program", Operator: "in", Value: []any{"Alpha"}}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 3)
		assert.Contains(t, values, "Alpha")
		assert.Contains(t, values, "Bravo")
		assert.Contains(t, values, "Charlie")
	})

	t.Run("deduplicates overlapping values", func(t *testing.T) {
		submitted := model.Condition{Attribute: "user.attributes.Program", Operator: "in", Value: []any{"Alpha", "Bravo"}}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 3)
	})

	t.Run("restores hidden values when submitted is nil (fully-masked placeholder)", func(t *testing.T) {
		submitted := model.Condition{Attribute: "user.attributes.Program", Operator: "in", Value: nil}
		result := mergeConditionValues(submitted, []string{"Bravo", "Charlie"})
		values, ok := result.Value.([]any)
		require.True(t, ok)
		assert.Len(t, values, 2)
	})

	t.Run("restores single hidden value when submitted is nil", func(t *testing.T) {
		submitted := model.Condition{Attribute: "user.attributes.Location", Operator: "==", Value: nil}
		result := mergeConditionValues(submitted, []string{"Building 7"})
		assert.Equal(t, "Building 7", result.Value)
	})
}

func TestGetHiddenValues(t *testing.T) {
	var a *App

	options := []any{
		map[string]any{"id": "id1", "name": "Alpha"},
		map[string]any{"id": "id2", "name": "Bravo"},
	}
	makeField := func(accessMode string, fieldType model.PropertyFieldType) *model.PropertyField {
		attrs := model.StringInterface{model.PropertyAttrsAccessMode: accessMode}
		if fieldType == model.PropertyFieldTypeSelect || fieldType == model.PropertyFieldTypeMultiselect {
			attrs[model.PropertyFieldAttributeOptions] = options
		}
		return &model.PropertyField{Type: fieldType, Attrs: attrs}
	}

	t.Run("AttrValue condition: returns nil immediately", func(t *testing.T) {
		stored := &model.Condition{Attribute: "user.attributes.Team", Value: "user.attributes.Dept", ValueType: model.AttrValue}
		assert.Nil(t, a.getHiddenValues(nil, "caller", stored, "", nil))
	})

	t.Run("field missing from prefetch map: returns nil (fail closed)", func(t *testing.T) {
		stored := &model.Condition{Attribute: "user.attributes.Program", Value: []any{"Alpha", "Bravo"}, ValueType: model.LiteralValue}
		assert.Nil(t, a.getHiddenValues(nil, "caller", stored, "", map[string]*model.PropertyField{}))
	})

	t.Run("source_only: all stored values treated as hidden", func(t *testing.T) {
		stored := &model.Condition{Attribute: "user.attributes.Clearance", Value: []any{"Top Secret", "Secret"}, ValueType: model.LiteralValue}
		fields := map[string]*model.PropertyField{"Clearance": makeField(model.PropertyAccessModeSourceOnly, model.PropertyFieldTypeSelect)}
		result := a.getHiddenValues(nil, "caller", stored, "", fields)
		assert.Equal(t, []string{"Top Secret", "Secret"}, result)
	})

	t.Run("shared_only select: values absent from options are hidden", func(t *testing.T) {
		stored := &model.Condition{Attribute: "user.attributes.Program", Value: []any{"Alpha", "Charlie"}, ValueType: model.LiteralValue}
		fields := map[string]*model.PropertyField{"Program": makeField(model.PropertyAccessModeSharedOnly, model.PropertyFieldTypeSelect)}
		result := a.getHiddenValues(nil, "caller", stored, "", fields)
		assert.Equal(t, []string{"Charlie"}, result)
	})

	t.Run("public field: no values hidden", func(t *testing.T) {
		stored := &model.Condition{Attribute: "user.attributes.Dept", Value: []any{"Eng", "Sales"}, ValueType: model.LiteralValue}
		fields := map[string]*model.PropertyField{"Dept": makeField(model.PropertyAccessModePublic, model.PropertyFieldTypeSelect)}
		result := a.getHiddenValues(nil, "caller", stored, "", fields)
		assert.Nil(t, result)
	})
}
