// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
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

func TestPropertyFieldIsValidBounds(t *testing.T) {
	below := func(ref PropertyBoundsReference) PropertyBoundsRule {
		return PropertyBoundsRule{Operator: PropertyBoundsOperatorAtOrBelow, Reference: ref}
	}
	above := func(ref PropertyBoundsReference) PropertyBoundsRule {
		return PropertyBoundsRule{Operator: PropertyBoundsOperatorAtOrAbove, Reference: ref}
	}
	parent, self := PropertyBoundsReferenceParent, PropertyBoundsReferenceSelf

	// A linked channel rank field with no rules, which every case below adjusts.
	field := func(mutate func(pf *PropertyField)) *PropertyField {
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "rank field",
			Type:          PropertyFieldTypeRank,
			ObjectType:    PropertyFieldObjectTypeChannel,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: NewPointer(NewId()),
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		mutate(pf)
		return pf
	}

	valid := map[string]func(pf *PropertyField){
		"no rules, unstated mutability": func(pf *PropertyField) {},
		"linked channel rank field with a parent rule and write_once": func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent)}
			pf.Mutability = PropertyFieldMutabilityWriteOnce
		},
		"unlinked user rank field with raise-only": func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeUser
			pf.LinkedFieldID = nil
			pf.Bounds = PropertyBounds{above(self)}
		},
		"system field with write_once and no rules": func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeSystem
			pf.Type = PropertyFieldTypeText
			pf.LinkedFieldID = nil
			pf.Mutability = PropertyFieldMutabilityWriteOnce
		},
		"empty mutability": func(pf *PropertyField) { pf.Mutability = "" },
		"explicit mutable": func(pf *PropertyField) { pf.Mutability = PropertyFieldMutabilityMutable },
		"post set_on_create": func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypePost
			pf.Mutability = PropertyFieldMutabilitySetOnCreate
		},
		"template with nothing set": func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeTemplate
			pf.LinkedFieldID = nil
		},
		"four distinct rules": func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent), above(parent), below(self), above(self)}
		},
	}
	for name, mutate := range valid {
		t.Run("valid: "+name, func(t *testing.T) {
			require.NoError(t, field(mutate).IsValid())
		})
	}

	refused := []struct {
		name      string
		mutate    func(pf *PropertyField)
		fieldName string
	}{
		{"unknown operator", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent), {Operator: "nearly", Reference: parent}}
		}, "bounds[1]"},
		{"unknown reference", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{{Operator: PropertyBoundsOperatorAtOrBelow, Reference: "sibling"}}
		}, "bounds[0]"},
		{"empty operator and reference", func(pf *PropertyField) { pf.Bounds = PropertyBounds{{}} }, "bounds[0]"},
		{"empty reference", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{{Operator: PropertyBoundsOperatorAtOrBelow}}
		}, "bounds[0]"},
		{"unknown mutability", func(pf *PropertyField) { pf.Mutability = "frozen" }, "mutability"},
		{"too many rules", func(pf *PropertyField) {
			pf.Bounds = make(PropertyBounds, PropertyFieldMaxBoundsRules+1)
			for i := range pf.Bounds {
				pf.Bounds[i] = below(parent)
			}
		}, "bounds"},
		{"same rule twice", func(pf *PropertyField) { pf.Bounds = PropertyBounds{below(parent), above(parent), below(parent)} }, "bounds[2]"},
		{"rule on a non-rank field", func(pf *PropertyField) {
			pf.Type = PropertyFieldTypeSelect
			pf.Bounds = PropertyBounds{below(parent)}
		}, "bounds[0]"},
		{"parent rule on an unlinked field", func(pf *PropertyField) {
			pf.LinkedFieldID = nil
			pf.Bounds = PropertyBounds{below(parent)}
		}, "bounds[0]"},
		{"parent rule on an object type with no parent", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeSystem
			pf.Bounds = PropertyBounds{below(parent)}
		}, "bounds[0]"},
		{"self rule with write_once", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{above(self)}
			pf.Mutability = PropertyFieldMutabilityWriteOnce
		}, "bounds[0]"},
		{"self rule with set_on_create", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent), below(self)}
			pf.Mutability = PropertyFieldMutabilitySetOnCreate
		}, "bounds[1]"},
		{"rule on a template field", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeTemplate
			pf.LinkedFieldID = nil
			pf.Bounds = PropertyBounds{below(self)}
		}, "bounds"},
		{"mutability on a template field", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeTemplate
			pf.LinkedFieldID = nil
			pf.Mutability = PropertyFieldMutabilityWriteOnce
		}, "mutability"},
		{"write_once on a session field", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeSession
			pf.LinkedFieldID = nil
			pf.Mutability = PropertyFieldMutabilityWriteOnce
		}, "mutability"},
		{"set_on_create on a user field", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeUser
			pf.Mutability = PropertyFieldMutabilitySetOnCreate
		}, "mutability"},
		{"set_on_create on a system field", func(pf *PropertyField) {
			pf.ObjectType = PropertyFieldObjectTypeSystem
			pf.LinkedFieldID = nil
			pf.Mutability = PropertyFieldMutabilitySetOnCreate
		}, "mutability"},
		// A later save that makes a held rule stop applying is refused at that save.
		{"rank field with a rule changed to select", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent)}
			pf.Type = PropertyFieldTypeSelect
		}, "bounds[0]"},
		{"field with a parent rule unlinked", func(pf *PropertyField) {
			pf.Bounds = PropertyBounds{below(parent)}
			pf.LinkedFieldID = nil
		}, "bounds[0]"},
	}
	for _, tc := range refused {
		t.Run("refused: "+tc.name, func(t *testing.T) {
			err := field(tc.mutate).IsValid()
			require.Error(t, err)
			var appErr *AppError
			require.ErrorAs(t, err, &appErr)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
			assert.Equal(t, tc.fieldName, appErr.params["FieldName"])
			assert.NotEmpty(t, appErr.params["Reason"])
		})
	}
}

func TestPropertyFieldParentObjectType(t *testing.T) {
	for objectType, want := range map[string]string{
		PropertyFieldObjectTypePost:     PropertyFieldObjectTypeChannel,
		PropertyFieldObjectTypeChannel:  PropertyFieldObjectTypeSystem,
		PropertyFieldObjectTypeUser:     PropertyFieldObjectTypeSystem,
		PropertyFieldObjectTypeSystem:   "",
		PropertyFieldObjectTypeTemplate: "",
		PropertyFieldObjectTypeSession:  "",
		"unknown":                       "",
	} {
		assert.Equal(t, want, PropertyFieldParentObjectType(objectType), objectType)
	}
}
