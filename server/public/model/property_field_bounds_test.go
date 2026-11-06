// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyFieldBoundsJSONRoundTrip(t *testing.T) {
	raw := []byte(`{
		"id": "fieldid",
		"bounds": [
			{"operator": "at_or_below", "reference": "parent"},
			{"operator": "at_or_above", "reference": "self"}
		],
		"mutability": "write_once"
	}`)

	var pf PropertyField
	require.NoError(t, json.Unmarshal(raw, &pf))
	assert.Equal(t, PropertyBounds{
		{Operator: PropertyBoundsOperatorAtOrBelow, Reference: PropertyBoundsReferenceParent},
		{Operator: PropertyBoundsOperatorAtOrAbove, Reference: PropertyBoundsReferenceSelf},
	}, pf.Bounds)
	assert.Equal(t, PropertyFieldMutabilityWriteOnce, pf.Mutability)

	out, err := json.Marshal(&pf)
	require.NoError(t, err)
	var pf2 PropertyField
	require.NoError(t, json.Unmarshal(out, &pf2))
	assert.Equal(t, pf, pf2)
}

func TestPropertyFieldWithoutRulesMarshalsWithoutKeys(t *testing.T) {
	out, err := json.Marshal(&PropertyField{ID: "fieldid"})
	require.NoError(t, err)

	var m map[string]any
	require.NoError(t, json.Unmarshal(out, &m))
	assert.NotContains(t, m, "bounds")
	assert.NotContains(t, m, "mutability")
}

func TestPropertyFieldBoundsAuditable(t *testing.T) {
	bounds := PropertyBounds{{Operator: PropertyBoundsOperatorAtOrBelow, Reference: PropertyBoundsReferenceParent}}
	mutability := PropertyFieldMutabilityWriteOnce

	pf := &PropertyField{Bounds: bounds, Mutability: mutability}
	assert.Equal(t, bounds, pf.Auditable()["bounds"])
	assert.Equal(t, mutability, pf.Auditable()["mutability"])

	patch := &PropertyFieldPatch{Bounds: &bounds, Mutability: &mutability}
	assert.Equal(t, &bounds, patch.Auditable()["bounds"])
	assert.Equal(t, &mutability, patch.Auditable()["mutability"])
}

func TestPropertyBoundsScan(t *testing.T) {
	want := PropertyBounds{{Operator: PropertyBoundsOperatorAtOrAbove, Reference: PropertyBoundsReferenceParent}}
	const text = `[{"operator":"at_or_above","reference":"parent"}]`

	t.Run("nil leaves bounds nil", func(t *testing.T) {
		var b PropertyBounds
		require.NoError(t, b.Scan(nil))
		assert.Nil(t, b)
	})
	t.Run("bytes", func(t *testing.T) {
		var b PropertyBounds
		require.NoError(t, b.Scan([]byte(text)))
		assert.Equal(t, want, b)
	})
	t.Run("string", func(t *testing.T) {
		var b PropertyBounds
		require.NoError(t, b.Scan(text))
		assert.Equal(t, want, b)
	})
	t.Run("other types are rejected", func(t *testing.T) {
		var b PropertyBounds
		assert.Error(t, b.Scan(42))
	})
}

func TestPropertyBoundsValueIsJSONText(t *testing.T) {
	v, err := PropertyBounds{{Operator: PropertyBoundsOperatorAtOrBelow, Reference: PropertyBoundsReferenceSelf}}.Value()
	require.NoError(t, err)
	s, ok := v.(string)
	require.True(t, ok, "Value must return a string, not %T", v)
	assert.JSONEq(t, `[{"operator":"at_or_below","reference":"self"}]`, s)
}

func TestPropertyBoundsEqual(t *testing.T) {
	below := PropertyBoundsRule{Operator: PropertyBoundsOperatorAtOrBelow, Reference: PropertyBoundsReferenceParent}
	above := PropertyBoundsRule{Operator: PropertyBoundsOperatorAtOrAbove, Reference: PropertyBoundsReferenceSelf}
	belowSelf := PropertyBoundsRule{Operator: PropertyBoundsOperatorAtOrBelow, Reference: PropertyBoundsReferenceSelf}

	assert.True(t, PropertyBoundsEqual(PropertyBounds{below, above}, PropertyBounds{above, below}), "order doesn't count")
	assert.True(t, PropertyBoundsEqual(nil, PropertyBounds{}), "nil equals empty")
	assert.True(t, PropertyBoundsEqual(PropertyBounds{below}, PropertyBounds{below}))
	assert.False(t, PropertyBoundsEqual(PropertyBounds{below}, PropertyBounds{belowSelf}), "different reference")
	assert.False(t, PropertyBoundsEqual(PropertyBounds{below}, nil))
	assert.False(t, PropertyBoundsEqual(PropertyBounds{below}, PropertyBounds{below, above}))
}
