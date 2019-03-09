package utils

import (
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestMergeWithMaps(t *testing.T) {
	t.Run("merge maps where patch is longer", func(t *testing.T) {
		m1 := map[string]int{"this": 1, "is": 2, "a map": 3}
		m2 := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}
		expected := map[string]int{"this": 1, "is": 3, "a map": 3, "a second map": 3, "another key": 4}
		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge maps where base is longer", func(t *testing.T) {
		m1 := map[string]int{"this": 1, "is": 2, "a map": 3, "with": 4, "more keys": -12}
		m2 := map[string]int{"this": 1, "is": 3, "a second map": 3}
		expected := map[string]int{"this": 1, "is": 3, "a map": 3, "a second map": 3, "with": 4, "more keys": -12}
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
		m1 := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}
		m2 := make(map[string]int)
		expected := map[string]int{"this": 1, "is": 3, "a second map": 3, "another key": 4}
		merged, err := mergeStringIntMap(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})
}

func TestMergeWithSlices(t *testing.T) {
	t.Run("merge slices where patch is longer", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten"}
		m2 := []string{"this one", "will", "replace the other", "one", "and", "is", "longer"}
		expected := []string{"this one", "will", "replace the other", "one", "and", "is", "longer"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge slices where base is longer", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one", "but", "not", "this"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge slices where base is empty slice", func(t *testing.T) {
		m1 := []string{}
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge slices where base is nil", func(t *testing.T) {
		var m1 []string
		m2 := []string{"this one", "will", "replace the other", "one"}
		expected := []string{"this one", "will", "replace the other", "one"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge slices where patch is empty struct", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		m2 := []string{}
		expected := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})

	t.Run("merge slices where patch is nil", func(t *testing.T) {
		m1 := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		var m2 []string
		expected := []string{"this", "will", "be", "overwritten", "but", "not", "this"}
		merged, err := mergeStringSlices(m1, m2)
		require.NoError(t, err)

		assert.Equal(t, expected, merged)
	})
}

func TestMergeWithStructs(t *testing.T) {
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
		*merged.Ip = 0
		assert.Equal(t, 99, *t1.Ip)
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

	t.Run("maps are merged", func(t *testing.T) {
		t1 := simple{42, 42.2, newFloat64(932.2), newInt(99), newBool(true),
			[]int{1, 2, 3}, map[string]int{"key1": 1, "key2": 2, "key4": 4},
			simple2{30, newString("test"), []string{"test1", "test2"}},
			&simple2{40, newString("test2"), []string{"test3", "test4", "test5"}}}
		t2 := simple{13, 53.1, newFloat64(932.2), nil, newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 11, "key2": 2, "key3": 3},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, nil, []string{"test3", "test4", "test99"}}}
		expected := simple{13, 0, nil, newInt(99), newBool(false),
			[]int{1, 2, 3}, map[string]int{"key1": 11, "key2": 2, "key3": 3, "key4": 4},
			simple2{30, newString("testpatch"), []string{"test1", "test2"}},
			&simple2{45, newString("test2"), []string{"test3", "test4", "test99"}}}

		merged, err := mergeSimple(t1, t2)
		require.NoError(t, err)

		assert.Equal(t, expected, *merged)
	})

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
		base.Struct1p.Ui = 734
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

func mergeSimple(base, patch simple) (*simple, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retS := ret.(simple)
	return &retS, nil
}

func mergeTestStructs(base, patch testStruct) (*testStruct, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retTS := ret.(testStruct)
	return &retTS, nil
}

func mergeStringIntMap(base, patch map[string]int) (map[string]int, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retTS := ret.(map[string]int)
	return retTS, nil
}

func mergeStringSlices(base, patch []string) ([]string, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retTS := ret.([]string)
	return retTS, nil
}

func mergeTestStructsPtrs(base, patch *testStruct) (*testStruct, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retTS := ret.(testStruct)
	return &retTS, nil
}

type simple struct {
	I   int
	f   float64
	fp  *float64
	Ip  *int
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

type testStruct struct {
	I        int
	I8       int8
	I16      int16
	I32      int32
	I64      int64
	F        float64
	F32      float32
	S        string
	Ui       uint
	Ui8      uint8
	Ui16     uint32
	Ui32     uint32
	Ui64     uint64
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
	Ui       uint
	Ui8      uint8
	Ui16     uint32
	Ui32     uint32
	Ui64     uint64
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
	Ui    uint
	Ui8   uint8
	Ui16  uint32
	Ui32  uint32
	Ui64  uint64
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
