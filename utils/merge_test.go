package utils

import (
	"github.com/stretchr/testify/require"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
)

func TestMergeWithStructs(t *testing.T) {
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

	t.Run("different base vals are overwritten by patch - simple", func(t *testing.T) {
		s1 := simple{42, NewBool(true), simple2{30}}
		s2 := simple{13, NewBool(false), simple2{30}}
		expected := simple{13, NewBool(false), simple2{30}}

		merged, err := mergeSimple(s1, s2)
		require.NoError(t, err)

		assert.NotEqual(t, s1, *merged)
		assert.Equal(t, expected, *merged)
	})

	t.Run("different base vals are overwritten by patch", func(t *testing.T) {
		setupStructs(t)

		base.F = 1342.12
		base.Struct1.Pi = NewInt(937)
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

func setupConfig(t *testing.T) *model.Config {
	t.Helper()

	cfg := &model.Config{}
	cfg.SetDefaults()
	return cfg
}

func TestMergeWithConfigs(t *testing.T) {
	t.Run("merge two default configs with different salts/keys", func(t *testing.T) {
		base := setupConfig(t)
		patch := setupConfig(t)

		merged, err := mergeConfig(base, patch)
		require.NoError(t, err)

		assert.Equal(t, patch, merged)
	})
	t.Run("merge identical configs", func(t *testing.T) {
		base := setupConfig(t)
		patch := base.Clone()

		merged, err := mergeConfig(base, patch)
		require.NoError(t, err)

		assert.Equal(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge configs with a different setting", func(t *testing.T) {
		base := setupConfig(t)
		patch := base.Clone()
		patch.ServiceSettings.SiteURL = NewString("http://newhost.ca")

		merged, err := mergeConfig(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge default config with changes from a mostly nil patch", func(t *testing.T) {
		base := setupConfig(t)
		patch := &model.Config{}
		patch.ServiceSettings.SiteURL = NewString("http://newhost.ca")
		patch.GoogleSettings.Enable = NewBool(true)

		expected := base.Clone()
		expected.ServiceSettings.SiteURL = NewString("http://newhost.ca")
		expected.GoogleSettings.Enable = NewBool(true)

		merged, err := mergeConfig(base, patch)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.NotEqual(t, patch, merged)
		assert.Equal(t, expected, merged)
	})
}

func mergeConfig(base, patch *model.Config) (*model.Config, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retC := ret.(model.Config)
	return &retC, nil
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

func mergeTestStructsPtrs(base, patch *testStruct) (*testStruct, error) {
	ret, err := Merge(base, patch)
	if err != nil {
		return nil, err
	}
	retTS := ret.(testStruct)
	return &retTS, nil
}

type simple struct {
	I  int
	B  *bool
	S2 simple2
}

type simple2 struct {
	I int
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
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	baseStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	baseStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	baseStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	baseStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		baseStructEmbed2A, &baseStructEmbed2B,
	}

	baseStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		baseStructEmbed2C, &baseStructEmbed2D,
	}

	base = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		baseStructEmbedBaseA, &baseStructEmbedBaseB,
	}

	patchStructEmbed2A = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	patchStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	patchStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	patchStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	patchStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		patchStructEmbed2A, &patchStructEmbed2B,
	}

	patchStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		patchStructEmbed2C, &patchStructEmbed2D,
	}

	patch = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		patchStructEmbedBaseA, &patchStructEmbedBaseB,
	}

	mergeStructEmbed2A = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	mergeStructEmbed2B = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	mergeStructEmbed2C = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	mergeStructEmbed2D = testStructEmbed2{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
	}

	mergeStructEmbedBaseA = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		mergeStructEmbed2A, &mergeStructEmbed2B,
	}

	mergeStructEmbedBaseB = testStructEmbed{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		mergeStructEmbed2C, &mergeStructEmbed2D,
	}

	expectedMerged = testStruct{1, 2, 3, 4, 5, 1.1, 2.2, "test", 10, 11, 12, 12, 13,
		NewInt(14), NewInt8(15), NewInt16(16), NewInt32(17), NewInt64(18),
		NewFloat64(19.9), NewFloat32(20.1), NewString("test pointer"),
		NewUint(21), NewUint8(22), NewUint16(23), NewUint32(24), NewUint64(25),
		[]string{"test", "slice", "strings"}, []int{1, 2, 3, 4}, []float64{1.1, 2.2, 3.3},
		map[string]int{"this": 1, "is": 2, "a": 3, "map": 4}, map[int]string{1: "this", 2: "is", 3: "another"},
		map[string]*int{"wow": NewInt(1), "a map": NewInt(2), "of pointers!": NewInt(3)},
		map[int]*string{1: NewString("Another"), 2: NewString("map of"), 3: NewString("pointers, wow!")},
		mergeStructEmbedBaseA, &mergeStructEmbedBaseB,
	}

}

func NewBool(b bool) *bool          { return &b }
func NewInt(n int) *int             { return &n }
func NewInt64(n int64) *int64       { return &n }
func NewString(s string) *string    { return &s }
func NewInt8(n int8) *int8          { return &n }
func NewInt16(n int16) *int16       { return &n }
func NewInt32(n int32) *int32       { return &n }
func NewFloat64(f float64) *float64 { return &f }
func NewFloat32(f float32) *float32 { return &f }
func NewUint(n uint) *uint          { return &n }
func NewUint8(n uint8) *uint8       { return &n }
func NewUint16(n uint16) *uint16    { return &n }
func NewUint32(n uint32) *uint32    { return &n }
func NewUint64(n uint64) *uint64    { return &n }
