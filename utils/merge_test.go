// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils_test

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/utils"
)

// Test merging maps alone. This isolates the complexity of merging maps from merging maps recursively in
// a struct/ptr/etc.
// Remember that for our purposes, "merging" means replacing base with patch if patch is /anything/ other than nil.
func TestMergeWithMaps(t *testing.T) {
	t.Run("merge maps where patch is longer", func(t *testing.T) {
		m1 := map[string]int{"this": 1, "is": 2, "a map": 3}
		m2 := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}

		expected := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}
		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge maps where base is longer", func(t *testing.T) {
		m1 := map[string]int{"this": 1, "is": 2, "a map": 3, "with": 4, "more keys": -12}
		m2 := map[string]int{"this": 1, "is": 3, "a second map": 3}
		expected := map[string]int{"this": 1, "is": 3, "a second map": 3}

		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge maps where base is empty", func(t *testing.T) {
		m1 := make(map[string]int)
		m2 := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}

		expected := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}
		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge maps where patch is empty", func(t *testing.T) {
		m1 := map[string]int{"this": 1, "is": 3, "a map": 3, "another key": 4}
		var m2 map[string]int
		expected := map[string]int{"this": 1, "is": 3, "a map": 3, "another key": 4}

		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]*int patch with different keys and values", func(t *testing.T) {
		m1 := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(3)}
		m2 := map[string]*int{"this": newInt(2), "is": newInt(3), "a key": newInt(4)}
		expected := map[string]*int{"this": newInt(2), "is": newInt(3), "a key": newInt(4)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]*int patch has nil keys -- doesn't matter, maps overwrite completely", func(t *testing.T) {
		m1 := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(3)}
		m2 := map[string]*int{"this": newInt(1), "is": nil, "a key": newInt(3)}
		expected := map[string]*int{"this": newInt(1), "is": nil, "a key": newInt(3)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]*int base has nil vals -- overwrite base with patch", func(t *testing.T) {
		m1 := map[string]*int{"this": newInt(1), "is": nil, "base key": newInt(4)}
		m2 := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(3)}
		expected := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(3)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]*int base has nil vals -- but patch is nil, so keep base", func(t *testing.T) {
		m1 := map[string]*int{"this": newInt(1), "is": nil, "base key": newInt(4)}
		var m2 map[string]*int
		expected := map[string]*int{"this": newInt(1), "is": nil, "base key": newInt(4)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]*int pointers are not copied - change in base do not affect merged", func(t *testing.T) {
		// that should never happen, since patch overwrites completely
		m1 := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(4)}
		m2 := map[string]*int{"this": newInt(1), "a key": newInt(5)}
		expected := map[string]*int{"this": newInt(1), "a key": newInt(5)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		*m1["this"] = 6
		assert.Equal(t, 1, *merged["this"])
	})

	t.Run("merge map[string]*int pointers are not copied - change in patched do not affect merged", func(t *testing.T) {
		m1 := map[string]*int{"this": newInt(1), "is": newInt(3), "a key": newInt(4)}
		m2 := map[string]*int{"this": newInt(2), "a key": newInt(5)}
		expected := map[string]*int{"this": newInt(2), "a key": newInt(5)}

		merged, err := mergeStringPtrIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		*m2["this"] = 6
		assert.Equal(t, 2, *merged["this"])
	})

	t.Run("merge map[string][]int overwrite base with patch", func(t *testing.T) {
		m1 := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		m2 := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}
		expected := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}

		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string][]int nil in patch /does/ overwrite base", func(t *testing.T) {
		m1 := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		m2 := map[string][]int{"this": {1, 2, 3}, "is": nil}
		expected := map[string][]int{"this": {1, 2, 3}, "is": nil}

		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string][]int nil in base is overwritten", func(t *testing.T) {
		m1 := map[string][]int{"this": {1, 2, 3}, "is": nil}
		m2 := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		expected := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string][]int nil in base is overwritten even without matching key", func(t *testing.T) {
		m1 := map[string][]int{"this": {1, 2, 3}, "is": nil}
		m2 := map[string][]int{"this": {1, 2, 3}, "new": {4, 5, 6}}
		expected := map[string][]int{"this": {1, 2, 3}, "new": {4, 5, 6}}

		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string][]int slice is cloned - change in base does not affect merged", func(t *testing.T) {
		// shouldn't, is patch clobbers
		m1 := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		m2 := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}
		expected := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}

		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		m1["this"][0] = 99
		assert.Equal(t, 1, merged["this"][0])
	})

	t.Run("merge map[string][]int slice is cloned - change in patch does not affect merged", func(t *testing.T) {
		m1 := map[string][]int{"this": {1, 2, 3}, "is": {4, 5, 6}}
		m2 := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}
		expected := map[string][]int{"this": {1, 2, 3}, "new": {7, 8, 9}}

		merged, err := mergeStringSliceIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		m2["new"][1] = 0
		assert.Equal(t, 8, merged["new"][1])
	})

	t.Run("merge map[string]map[string]*int", func(t *testing.T) {
		m1 := map[string]map[string]*int{"this": {"second": newInt(99)}, "base": {"level": newInt(10)}}
		m2 := map[string]map[string]*int{"this": {"second": newInt(77)}, "patch": {"level": newInt(15)}}
		expected := map[string]map[string]*int{"this": {"second": newInt(77)}, "patch": {"level": newInt(15)}}

		merged, err := mergeMapOfMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]map[string]*int, patch has nil keys -- /do/ overwrite base with nil", func(t *testing.T) {
		m1 := map[string]map[string]*int{"this": {"second": newInt(99)}, "base": {"level": newInt(10)}}
		m2 := map[string]map[string]*int{"this": {"second": nil}, "base": nil, "patch": {"level": newInt(15)}}
		expected := map[string]map[string]*int{"this": {"second": nil}, "base": nil, "patch": {"level": newInt(15)}}

		merged, err := mergeMapOfMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]map[string]*int, base has nil vals -- overwrite base with patch", func(t *testing.T) {
		m1 := map[string]map[string]*int{"this": {"second": nil}, "base": nil}
		m2 := map[string]map[string]*int{"this": {"second": newInt(77)}, "base": {"level": newInt(10)}, "patch": {"level": newInt(15)}}
		expected := map[string]map[string]*int{"this": {"second": newInt(77)}, "base": {"level": newInt(10)}, "patch": {"level": newInt(15)}}

		merged, err := mergeMapOfMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]map[string]*int, pointers are not copied - change in base does not affect merged", func(t *testing.T) {
		// shouldn't, if we're overwriting completely
		m1 := map[string]map[string]*int{"this": {"second": newInt(99)}, "base": {"level": newInt(10)}, "are belong": {"to us": newInt(23)}}
		m2 := map[string]map[string]*int{"base": {"level": newInt(10)}}
		expected := map[string]map[string]*int{"base": {"level": newInt(10)}}

		merged, err := mergeMapOfMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)

		// test changing the map entry's referenced value
		*m1["base"]["level"] = 347
		assert.Equal(t, 10, *merged["base"]["level"])

		// test replacing map entry
		m1["base"]["level"] = newInt(12)
		assert.Equal(t, 10, *merged["base"]["level"])

		// test replacing a referenced map
		m1["base"] = map[string]*int{"third": newInt(777)}
		assert.Equal(t, 10, *merged["base"]["level"])

	})

	t.Run("merge map[string]map[string]*int, pointers are not copied - change in patch do not affect merged", func(t *testing.T) {
		m1 := map[string]map[string]*int{"base": {"level": newInt(15)}}
		m2 := map[string]map[string]*int{"this": {"second": newInt(99)}, "patch": {"level": newInt(10)},
			"are belong": {"to us": newInt(23)}}
		expected := map[string]map[string]*int{"this": {"second": newInt(99)}, "patch": {"level": newInt(10)},
			"are belong": {"to us": newInt(23)}}

		merged, err := mergeMapOfMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)

		// test replacing a referenced map
		m2["this"] = map[string]*int{"third": newInt(777)}
		assert.Equal(t, 99, *merged["this"]["second"])

		// test replacing map entry
		m2["patch"]["level"] = newInt(12)
		assert.Equal(t, 10, *merged["patch"]["level"])

		// test changing the map entry's referenced value
		*m2["are belong"]["to us"] = 347
		assert.Equal(t, 23, *merged["are belong"]["to us"])
	})

	t.Run("merge map[string]any", func(t *testing.T) {
		m1 := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"base": map[string]*int{"level": newInt(10)}}
		m2 := map[string]any{"this": map[string]*int{"second": newInt(77)},
			"patch": map[string]*int{"level": newInt(15)}}
		expected := map[string]any{"this": map[string]*int{"second": newInt(77)},
			"patch": map[string]*int{"level": newInt(15)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]any, patch has nil keys -- /do/ overwrite base with nil", func(t *testing.T) {
		m1 := map[string]any{"this": map[string]*int{"second": newInt(99)}}
		m2 := map[string]any{"this": map[string]*int{"second": nil}}
		expected := map[string]any{"this": map[string]*int{"second": nil}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]any, patch has nil keys -- /do/ overwrite base with nil (more complex)", func(t *testing.T) {
		m1 := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"base": map[string]*int{"level": newInt(10)}}
		m2 := map[string]any{"this": map[string]*int{"second": nil},
			"base": nil, "patch": map[string]*int{"level": newInt(15)}}
		expected := map[string]any{"this": map[string]*int{"second": nil},
			"base": nil, "patch": map[string]*int{"level": newInt(15)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]map[string]*int, base has nil vals -- overwrite base with patch", func(t *testing.T) {
		m1 := map[string]any{"base": nil}
		m2 := map[string]any{"base": map[string]*int{"level": newInt(10)}}
		expected := map[string]any{"base": map[string]*int{"level": newInt(10)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]map[string]*int, base has nil vals -- overwrite base with patch (more complex)", func(t *testing.T) {
		m1 := map[string]any{"this": map[string]*int{"second": nil}, "base": nil}
		m2 := map[string]any{"this": map[string]*int{"second": newInt(77)},
			"base": map[string]*int{"level": newInt(10)}, "patch": map[string]*int{"level": newInt(15)}}
		expected := map[string]any{"this": map[string]*int{"second": newInt(77)},
			"base": map[string]*int{"level": newInt(10)}, "patch": map[string]*int{"level": newInt(15)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge map[string]any, pointers are not copied - changes in base do not affect merged", func(t *testing.T) {
		m1 := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"base": map[string]*int{"level": newInt(10)}, "are belong": map[string]*int{"to us": newInt(23)}}
		m2 := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"base": map[string]*int{"level": newInt(10)}, "are belong": map[string]*int{"to us": newInt(23)}}
		expected := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"base": map[string]*int{"level": newInt(10)}, "are belong": map[string]*int{"to us": newInt(23)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)

		// test replacing a referenced map
		m1["this"] = map[string]*int{"third": newInt(777)}
		assert.Equal(t, 99, *merged["this"].(map[string]*int)["second"])

		// test replacing map entry
		m1["base"].(map[string]*int)["level"] = newInt(12)
		assert.Equal(t, 10, *merged["base"].(map[string]*int)["level"])

		// test changing the map entry's referenced value
		*m1["are belong"].(map[string]*int)["to us"] = 347
		assert.Equal(t, 23, *merged["are belong"].(map[string]*int)["to us"])
	})

	t.Run("merge map[string]any, pointers are not copied - change in patch do not affect merged", func(t *testing.T) {
		m1 := map[string]any{"base": map[string]*int{"level": newInt(15)}}
		m2 := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"patch": map[string]*int{"level": newInt(10)}, "are belong": map[string]*int{"to us": newInt(23)}}
		expected := map[string]any{"this": map[string]*int{"second": newInt(99)},
			"patch": map[string]*int{"level": newInt(10)}, "are belong": map[string]*int{"to us": newInt(23)}}

		merged, err := mergeInterfaceMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)

		// test replacing a referenced map
		m2["this"] = map[string]*int{"third": newInt(777)}
		assert.Equal(t, 99, *merged["this"].(map[string]*int)["second"])

		// test replacing map entry
		m2["patch"].(map[string]*int)["level"] = newInt(12)
		assert.Equal(t, 10, *merged["patch"].(map[string]*int)["level"])

		// test changing the map entry's referenced value
		*m2["are belong"].(map[string]*int)["to us"] = 347
		assert.Equal(t, 23, *merged["are belong"].(map[string]*int)["to us"])
	})
}

// Test merging slices alone. This isolates the complexity of merging slices from merging slices
// recursively in a struct/ptr/etc.
func TestMergeWithSlices(t *testing.T) {
	t.Run("patch overwrites base slice", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten"}
		m2 := []string{"this one", "will", "replace the other", "one", "and", "is", "longer"}
		expected := []string{"this one", "will", "replace the other", "one", "and", "is", "longer"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("patch overwrites base even when base is longer", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("patch overwrites  when base is empty slice", func(t *testing.T) {
		m1 := []string{}
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("patch overwrites when base is nil", func(t *testing.T) {
		var m1 []string
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("patch overwrites when patch is empty struct", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten"}
		m2 := []string{}
		expected := []string{}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("use base where patch is nil", func(t *testing.T) {
		m1 := []string{"this", "will", "not", "be", "overwritten"}
		var m2 []string
		expected := []string{"this", "will", "not", "be", "overwritten"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("return nil where both are nil", func(t *testing.T) {
		var m1 []string
		var m2 []string
		expected := []string(nil)

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("return empty struct where both are empty", func(t *testing.T) {
		m1 := []string{}
		m2 := []string{}
		expected := []string{}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("patch is nil, slice is not copied. change in base will not affect merged", func(t *testing.T) {
		m1 := []string{"this", "will", "not", "be", "overwritten"}
		var m2 []string
		expected := []string{"this", "will", "not", "be", "overwritten"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		m1[0] = "THAT"
		assert.Equal(t, "this", merged[0])
	})

	t.Run("patch empty, slice is not copied. change in patch will not affect merged", func(t *testing.T) {
		m1 := []string{"this", "will", "not", "be", "overwritten"}
		m2 := []string{}
		expected := []string{}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		// of course this won't change merged, even if it did copy... but just in case.
		m2 = append(m2, "test")
		assert.Len(t, m2, 1)
		assert.Empty(t, merged)
	})

	t.Run("slice is not copied. change in patch will not affect merged", func(t *testing.T) {
		var m1 []string
		m2 := []string{"this", "will", "not", "be", "overwritten"}
		expected := []string{"this", "will", "not", "be", "overwritten"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		m2[0] = "THAT"
		assert.Equal(t, "this", merged[0])
	})

	t.Run("base overwritten, slice is not copied. change in patch will not affect merged", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten"}
		m2 := []string{"that", "overwrote", "it"}
		expected := []string{"that", "overwrote", "it"}

		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
		m2[0] = "THAT!!"
		assert.Equal(t, "that", merged[0])
	})
}

type evenSimpler struct {
	B   *bool
	ES2 *evenSimpler2
}

func (e *evenSimpler) String() string {
	if e == nil {
		return "nil"
	}
	sb := "nil"
	if e.B != nil {
		sb = fmt.Sprintf("%t", *e.B)
	}
	return fmt.Sprintf("ES{B: %s, ES2: %s}", sb, e.ES2.String())
}

type evenSimpler2 struct {
	S *string
}

func (e *evenSimpler2) String() string {
	if e == nil {
		return "nil"
	}
	var s string
	if e.S == nil {
		s = "nil"
	} else {
		s = *e.S
	}
	return fmt.Sprintf("ES2{S: %s}", s)
}

func TestMergeWithEvenSimpler(t *testing.T) {
	t.Run("evenSimplerStruct: base nils are overwritten by patch", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), &evenSimpler2{nil}}
		t2 := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}
		expected := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("evenSimplerStruct: patch nils are ignored", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}
		t2 := evenSimpler{nil, &evenSimpler2{nil}}
		expected := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("evenSimplerStruct: can handle both nils, merged will have nil (not zero value)", func(t *testing.T) {
		t1 := evenSimpler{nil, &evenSimpler2{nil}}
		t2 := evenSimpler{nil, &evenSimpler2{nil}}
		expected := evenSimpler{nil, &evenSimpler2{nil}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("evenSimplerStruct: can handle both nils (ptr to ptr), merged will have nil (not zero value)", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), nil}
		t2 := evenSimpler{newBool(true), nil}
		expected := evenSimpler{newBool(true), nil}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("evenSimplerStruct: base nils (ptr to ptr) are overwritten by patch", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), nil}
		t2 := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}
		expected := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("evenSimplerStruct: base nils (ptr to ptr) are overwritten by patch, and not copied - changes in patch don't affect merged", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), nil}
		t2 := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}
		expected := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
		*t2.ES2.S = "new patch"
		assert.Equal(t, "patch", *merged.ES2.S)
	})

	t.Run("evenSimplerStruct: patch nils (ptr to ptr) do not overwrite base, and are not copied - changes in base don't affect merged", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}
		t2 := evenSimpler{newBool(false), nil}
		expected := evenSimpler{newBool(false), &evenSimpler2{newString("base")}}

		merged, err := mergeEvenSimpler(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
		*t1.ES2.S = "new base"
		assert.Equal(t, "base", *merged.ES2.S)
	})

}

type sliceStruct struct {
	Sls []string
}

func TestMergeWithSliceStruct(t *testing.T) {
	t.Run("patch nils are ignored - sliceStruct", func(t *testing.T) {
		t1 := sliceStruct{[]string{"this", "is", "base"}}
		t2 := sliceStruct{nil}
		expected := sliceStruct{[]string{"this", "is", "base"}}

		merged, err := mergeSliceStruct(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("base nils are overwritten by patch - sliceStruct", func(t *testing.T) {
		t1 := sliceStruct{nil}
		t2 := sliceStruct{[]string{"this", "is", "patch"}}
		expected := sliceStruct{[]string{"this", "is", "patch"}}

		merged, err := mergeSliceStruct(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("slices are not being copied or modified", func(t *testing.T) {
		t1 := sliceStruct{[]string{"this", "is", "base"}}
		t2 := sliceStruct{nil}
		expected := sliceStruct{[]string{"this", "is", "base"}}

		merged, err := mergeSliceStruct(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)

		// changes in base do not affect merged
		t1.Sls[0] = "test0"
		assert.Equal(t, "this", merged.Sls[0])

		// changes in merged (on slice that was cloned from base) do not affect base
		merged.Sls[1] = "test222"
		assert.Equal(t, "is", t1.Sls[1])
	})

	t.Run("slices are not being copied or modified", func(t *testing.T) {
		t1 := sliceStruct{nil}
		t2 := sliceStruct{[]string{"this", "is", "patch"}}
		expected := sliceStruct{[]string{"this", "is", "patch"}}

		merged, err := mergeSliceStruct(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)

		// changes in patch do not affect merged
		t2.Sls[0] = "test0"
		assert.Equal(t, "this", merged.Sls[0])

		// changes in merged (on slice that was cloned from patch) do not affect patch
		merged.Sls[1] = "test222"
		assert.Equal(t, "is", t2.Sls[1])
	})
}

type mapPtr struct {
	MP map[string]*evenSimpler2
}

func TestMergeWithMapPtr(t *testing.T) {
	t.Run("patch nils overwrite - mapPtr - maps overwrite completely", func(t *testing.T) {
		t1 := mapPtr{map[string]*evenSimpler2{"base key": {newString("base")}}}
		t2 := mapPtr{map[string]*evenSimpler2{"base key": {nil}}}
		expected := mapPtr{map[string]*evenSimpler2{"base key": {nil}}}

		merged, err := mergeMapPtr(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("patch nil structs are ignored - mapPtr - maps overwrite ", func(t *testing.T) {
		t1 := mapPtr{map[string]*evenSimpler2{"base key": {newString("base")}}}
		t2 := mapPtr{map[string]*evenSimpler2{"base key": nil}}
		expected := mapPtr{map[string]*evenSimpler2{"base key": nil}}

		merged, err := mergeMapPtr(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})
}

type mapPtrState struct {
	MP map[string]*state
}
type state struct {
	Enable bool
}

func TestMergeWithMapPtrState(t *testing.T) {
	t.Run("inside structs, patch map overwrites completely - mapPtrState", func(t *testing.T) {
		t1 := mapPtrState{map[string]*state{"base key": {true}}}
		t2 := mapPtrState{map[string]*state{"base key": nil}}
		expected := mapPtrState{map[string]*state{"base key": nil}}

		merged, err := mergeMapPtrState(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("merge identical structs - simple", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		expected := simple{42, 0, nil, newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("base nils are overwritten by patch", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), nil,
			[]int{1, 2, 3}, nil,
			simple2{30, nil, nil},
			nil}
		t2 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		expected := simple{42, 0, nil, newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})
}

type mapPtrState2 struct {
	MP map[string]*state2
}
type state2 struct {
	Enable bool
	EPtr   *bool
}

func TestMergeWithMapPtrState2(t *testing.T) {
	t.Run("inside structs, maps overwrite completely - mapPtrState2", func(t *testing.T) {
		t1 := mapPtrState2{map[string]*state2{"base key": {true, newBool(true)}}}
		t2 := mapPtrState2{map[string]*state2{"base key": {false, nil}}}
		expected := mapPtrState2{map[string]*state2{"base key": {false, nil}}}

		merged, err := mergeMapPtrState2(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("inside structs, maps overwrite completely - mapPtrState2 2", func(t *testing.T) {
		t1 := mapPtrState2{map[string]*state2{"base key": {true, newBool(true)}}} //
		t2 := mapPtrState2{map[string]*state2{"base key": nil}}
		expected := mapPtrState2{map[string]*state2{"base key": nil}}

		merged, err := mergeMapPtrState2(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})
}

type simple struct {
	I   int
	f   float64
	fp  *float64
	IP  *int
	B   *bool
	Sli []int
	Msi map[string]int
	S2  simple2
	S3  *simple2
}

type simple2 struct {
	I   int
	S   *string
	Sls []string
}

func TestMergeWithSimpleStruct(t *testing.T) {
	t.Run("patch nils are ignored", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test base"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{42, 42.2, newFloat64(932.2), nil, nil,
			nil, nil,
			simple2{30, nil, nil},
			&simple2{42, nil, nil}}
		expected := simple{42, 0, nil, newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test base"), []string{"test1", "test2"}},
			&simple2{42, newString("test2"), []string{"test3", "test4", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("patch nilled structs are ignored", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test base"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test base"), []string{"test1", "test2"}},
			nil}
		expected := simple{42, 0, nil, newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test base"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("can handle both nils", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), nil,
			[]int{1, 2, 3}, nil,
			simple2{30, nil, nil},
			nil}
		t2 := simple{42, 42.2, newFloat64(932.2), newInt(45), nil,
			[]int{1, 2, 3}, nil,
			simple2{30, nil, nil},
			nil}
		expected := simple{42, 0, nil, newInt(45), nil,
			[]int{1, 2, 3}, nil,
			simple2{30, nil, nil},
			nil}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("different base vals are overwritten by patch, and unexported fields are ignored", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(45), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), newInt(46), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test99"}},
			&simple2{45, nil, []string{"test3", "test123", "test5"}}}
		expected := simple{13, 0, nil, newInt(46), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test99"}},
			&simple2{45, newString("test2"), []string{"test3", "test123", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.NotEqual(t, t1, *merged)
		assert.Equal(t, expected, *merged)
	})

	t.Run("pointers are not being copied or modified", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(99), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), nil, newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, nil, []string{"test3", "test4", "test5"}}}
		expected := simple{13, 0, nil, newInt(99), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, newString("test2"), []string{"test3", "test4", "test5"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.NotEqual(t, t1, *merged)
		assert.Equal(t, expected, *merged)

		// changes in originals do not affect merged
		*t1.S3.S = "testBASE"
		assert.Equal(t, "test2", *merged.S3.S)
		*t2.B = true
		assert.Equal(t, false, *merged.B)

		// changes in base do not affect patched
		*t1.S2.S = "test from base"
		assert.NotEqual(t, *t1.S2.S, *t2.S2.S)

		// changes in merged (on pointers that were cloned from base or patch) do not affect base or patch
		*merged.IP = 0
		assert.Equal(t, 99, *t1.IP)
		*merged.S2.S = "testMERGED"
		assert.NotEqual(t, *t2.S2.S, *merged.S2.S)
	})

	t.Run("slices are not being copied or modified", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(99), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), nil, newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), nil},
			&simple2{45, nil, []string{"test3", "test4", "test99"}}}
		expected := simple{13, 0, nil, newInt(99), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, newString("test2"), []string{"test3", "test4", "test99"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.NotEqual(t, t1, *merged)
		assert.Equal(t, expected, *merged)

		// changes in base do not affect merged
		t1.S2.Sls[0] = "test0"
		assert.Equal(t, "test1", merged.S2.Sls[0])

		// changes in patch do not affect merged
		t2.S3.Sls[0] = "test0"
		assert.Equal(t, "test3", merged.S3.Sls[0])

		// changes in merged (on slice that was cloned from base) do not affect base
		merged.S2.Sls[1] = "test222"
		assert.Equal(t, "test2", t1.S2.Sls[1])
	})

	t.Run("maps are not being copied or modified: base -> merged", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(99), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), nil, newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, nil, []string{"test3", "test4", "test99"}}}
		expected := simple{13, 0, nil, newInt(99), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, newString("test2"), []string{"test3", "test4", "test99"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.NotEqual(t, t1, *merged)
		assert.Equal(t, expected, *merged)

		// changes in originals do not affect merged
		t1.Msi["key1"] = 3
		assert.Equal(t, 1, merged.Msi["key1"])
		t2.Msi["key5"] = 5
		_, ok := merged.Msi["key5"]
		assert.False(t, ok)
	})

	t.Run("patch map overwrites", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(99), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2, "key4": 4},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), nil, newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 11, "key2": 2, "key3": 3},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, nil, []string{"test3", "test4", "test99"}}}
		expected := simple{13, 0, nil, newInt(99), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 11, "key2": 2, "key3": 3},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, newString("test2"), []string{"test3", "test4", "test99"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})
}

// The following are tests to see if multiply nested structs/maps/slice and pointers to structs/maps/slices
// will merge. Probably overkill, but if anything goes wrong here, it is best to isolate the problem and
// make a simplified test (like many of the above tests).
func TestMergeWithVeryComplexStruct(t *testing.T) {
	t.Run("merge identical structs", func(t *testing.T) {
		setupStructs(t)

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.Equal(t, expectedMerged, *merged)
	})

	t.Run("merge identical structs as pointers", func(t *testing.T) {
		setupStructs(t)

		merged, err := mergeTestStructsPtrs(&base, &patch)
		require.NoError(t, err)

		assert.Equal(t, expectedMerged, *merged)
	})

	t.Run("different base vals are overwritten by patch", func(t *testing.T) {
		setupStructs(t)

		base.F = 1342.12
		base.Struct1.Pi = newInt(937)
		base.Struct1p.UI = 734
		base.Struct1.Struct2.Sli = []int{123123, 1243123}

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, base, *merged)
		assert.Equal(t, patch, *merged)
	})

	t.Run("nil values in patch are ignored", func(t *testing.T) {
		setupStructs(t)

		patch.Pi = nil
		patch.Struct1.Pi16 = nil

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, patch, *merged)
		assert.Equal(t, expectedMerged, *merged)
	})

	t.Run("nil structs in patch are ignored", func(t *testing.T) {
		setupStructs(t)

		patch.Struct1p = nil
		patch.Struct1.Struct2p = nil

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, patch, *merged)
		assert.Equal(t, expectedMerged, *merged)
	})

	t.Run("nil slices in patch are ignored", func(t *testing.T) {
		setupStructs(t)

		patch.Sls = nil
		patch.Struct1.Sli = nil
		patch.Struct1.Struct2p.Slf = nil

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, patch, *merged)
		assert.Equal(t, expectedMerged, *merged)
	})

	t.Run("nil maps in patch are ignored", func(t *testing.T) {
		setupStructs(t)

		patch.Msi = nil
		patch.Mspi = nil
		patch.Struct1.Mis = nil
		patch.Struct1.Struct2p.Mspi = nil

		merged, err := mergeTestStructs(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, patch, *merged)
		assert.Equal(t, expectedMerged, *merged)
	})
}

func TestMergeWithStructFieldFilter(t *testing.T) {
	t.Run("filter skips merging from patch", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}
		t2 := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}
		expected := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}

		merged, err := mergeEvenSimplerWithConfig(t1, t2, &utils.MergeConfig{
			StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
				return false
			},
		})
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

	t.Run("filter skips merging configured fields from patch", func(t *testing.T) {
		t1 := evenSimpler{newBool(true), &evenSimpler2{newString("base")}}
		t2 := evenSimpler{newBool(false), &evenSimpler2{newString("patch")}}
		expected := evenSimpler{newBool(false), &evenSimpler2{newString("base")}}

		merged, err := mergeEvenSimplerWithConfig(t1, t2, &utils.MergeConfig{
			StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
				return structField.Name == "B"
			},
		})
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})
}

type testStruct struct {
	I        int
	I8       int8
	I16      int16
	I32      int32
	I64      int64
	F        float64
	F32      float32
	S        string
	UI       uint
	UI8      uint8
	UI16     uint32
	UI32     uint32
	UI64     uint64
	Pi       *int
	Pi8      *int8
	Pi16     *int16
	Pi32     *int32
	Pi64     *int64
	Pf       *float64
	Pf32     *float32
	Ps       *string
	Pui      *uint
	Pui8     *uint8
	Pui16    *uint16
	Pui32    *uint32
	Pui64    *uint64
	Sls      []string
	Sli      []int
	Slf      []float64
	Msi      map[string]int
	Mis      map[int]string
	Mspi     map[string]*int
	Mips     map[int]*string
	Struct1  testStructEmbed
	Struct1p *testStructEmbed
}

type testStructEmbed struct {
	I        int
	I8       int8
	I16      int16
	I32      int32
	I64      int64
	F        float64
	F32      float32
	S        string
	UI       uint
	UI8      uint8
	UI16     uint32
	UI32     uint32
	UI64     uint64
	Pi       *int
	Pi8      *int8
	Pi16     *int16
	Pi32     *int32
	Pi64     *int64
	Pf       *float64
	Pf32     *float32
	Ps       *string
	Pui      *uint
	Pui8     *uint8
	Pui16    *uint16
	Pui32    *uint32
	Pui64    *uint64
	Sls      []string
	Sli      []int
	Slf      []float64
	Msi      map[string]int
	Mis      map[int]string
	Mspi     map[string]*int
	Mips     map[int]*string
	Struct2  testStructEmbed2
	Struct2p *testStructEmbed2
}

type testStructEmbed2 struct {
	I     int
	I8    int8
	I16   int16
	I32   int32
	I64   int64
	F     float64
	F32   float32
	S     string
	UI    uint
	UI8   uint8
	UI16  uint32
	UI32  uint32
	UI64  uint64
	Pi    *int
	Pi8   *int8
	Pi16  *int16
	Pi32  *int32
	Pi64  *int64
	Pf    *float64
	Pf32  *float32
	Ps    *string
	Pui   *uint
	Pui8  *uint8
	Pui16 *uint16
	Pui32 *uint32
	Pui64 *uint64
	Sls   []string
	Sli   []int
	Slf   []float64
	Msi   map[string]int
	Mis   map[int]string
	Mspi  map[string]*int
	Mips  map[int]*string
}

// the base structs
var baseStructEmbed2A, baseStructEmbed2B, baseStructEmbed2C, baseStructEmbed2D testStructEmbed2
var baseStructEmbedBaseA, baseStructEmbedBaseB testStructEmbed
var base testStruct

// the patch structs
var patchStructEmbed2A, patchStructEmbed2B, patchStructEmbed2C, patchStructEmbed2D testStructEmbed2
var patchStructEmbedBaseA, patchStructEmbedBaseB testStructEmbed
var patch testStruct

// The merged structs
var mergeStructEmbed2A, mergeStructEmbed2B, mergeStructEmbed2C, mergeStructEmbed2D testStructEmbed2
var mergeStructEmbedBaseA, mergeStructEmbedBaseB testStructEmbed
var expectedMerged testStruct

func setupStructs(t *testing.T) {
	t.Helper()

	baseStructEmbed2A = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	baseStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	baseStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	baseStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	baseStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		baseStructEmbed2A, &baseStructEmbed2B,
	}

	baseStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		baseStructEmbed2C, &baseStructEmbed2D,
	}

	base = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		baseStructEmbedBaseA, &baseStructEmbedBaseB,
	}

	patchStructEmbed2A = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	patchStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	patchStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	patchStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	patchStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		patchStructEmbed2A, &patchStructEmbed2B,
	}

	patchStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		patchStructEmbed2C, &patchStructEmbed2D,
	}

	patch = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		patchStructEmbedBaseA, &patchStructEmbedBaseB,
	}

	mergeStructEmbed2A = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	mergeStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	mergeStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	mergeStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
	}

	mergeStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		mergeStructEmbed2A, &mergeStructEmbed2B,
	}

	mergeStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		mergeStructEmbed2C, &mergeStructEmbed2D,
	}

	expectedMerged = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		newInt(14), newInt8(15), newInt16(16), newInt32(17), newInt64(18),
		newFloat64(19.9), newFloat32(20.1), newString("test pointer"),
		newUint(21), newUint8(22), newUint16(23), newUint32(24), newUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": newInt(1), "a map": newInt(2), "of pointers!": newInt(3)},
		map[int]*string{1: newString("Another"), 2: newString("map of"), 3: newString("pointers, wow!")},
		mergeStructEmbedBaseA, &mergeStructEmbedBaseB,
	}
}

func mergeSimple(base, patch simple) (*simple, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retS := ret.(simple)
	return &retS, nil
}

func mergeEvenSimpler(base, patch evenSimpler) (*evenSimpler, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(evenSimpler)
	return &retTS, nil
}

func mergeEvenSimplerWithConfig(base, patch evenSimpler, mergeConfig *utils.MergeConfig) (*evenSimpler, error) {
	ret, err := utils.Merge(base, patch, mergeConfig)
	if err != nil {
		return nil, err
	}
	retTS := ret.(evenSimpler)
	return &retTS, nil
}

func mergeSliceStruct(base, patch sliceStruct) (*sliceStruct, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(sliceStruct)
	return &retTS, nil
}

func mergeMapPtr(base, patch mapPtr) (*mapPtr, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(mapPtr)
	return &retTS, nil
}

func mergeMapPtrState(base, patch mapPtrState) (*mapPtrState, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(mapPtrState)
	return &retTS, nil
}

func mergeMapPtrState2(base, patch mapPtrState2) (*mapPtrState2, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(mapPtrState2)
	return &retTS, nil
}

func mergeTestStructs(base, patch testStruct) (*testStruct, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(testStruct)
	return &retTS, nil
}

func mergeStringIntMap(base, patch map[string]int) (map[string]int, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string]int)
	return retTS, nil
}

func mergeStringPtrIntMap(base, patch map[string]*int) (map[string]*int, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string]*int)
	return retTS, nil
}

func mergeStringSliceIntMap(base, patch map[string][]int) (map[string][]int, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string][]int)
	return retTS, nil
}

func mergeMapOfMap(base, patch map[string]map[string]*int) (map[string]map[string]*int, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string]map[string]*int)
	return retTS, nil
}

func mergeInterfaceMap(base, patch map[string]any) (map[string]any, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string]any)
	return retTS, nil
}

func mergeStringSlices(base, patch []string) ([]string, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.([]string)
	return retTS, nil
}

func mergeTestStructsPtrs(base, patch *testStruct) (*testStruct, error) {
	ret, err := utils.Merge(base, patch, nil)
	if err != nil {
		return nil, err
	}
	retTS := ret.(testStruct)
	return &retTS, nil
}

func newBool(b bool) *bool          { return &b }
func newInt(n int) *int             { return &n }
func newInt64(n int64) *int64       { return &n }
func newString(s string) *string    { return &s }
func newInt8(n int8) *int8          { return &n }
func newInt16(n int16) *int16       { return &n }
func newInt32(n int32) *int32       { return &n }
func newFloat64(f float64) *float64 { return &f }
func newFloat32(f float32) *float32 { return &f }
func newUint(n uint) *uint          { return &n }
func newUint8(n uint8) *uint8       { return &n }
func newUint16(n uint16) *uint16    { return &n }
func newUint32(n uint32) *uint32    { return &n }
func newUint64(n uint64) *uint64    { return &n }
