package immutable

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOrderedMap(t *testing.T) {
	var m *OrderedMap
	assert.True(t, m.Empty())
	assert.Equal(t, 0, m.Len())
	require.NoError(t, m.invariant())

	m = m.Set("foo", "bar")
	assert.False(t, m.Empty())
	assert.Equal(t, 1, m.Len())
	require.NoError(t, m.invariant())

	v, ok := m.Get("foo")
	assert.True(t, ok)
	assert.Equal(t, "bar", v)

	_, ok = m.Get("fom")
	assert.False(t, ok)

	_, ok = m.Get("fop")
	assert.False(t, ok)

	m = m.Set("qux", "quux")
	assert.False(t, m.Empty())
	assert.Equal(t, 2, m.Len())
	require.NoError(t, m.invariant())

	v, ok = m.Get("foo")
	assert.True(t, ok)
	assert.Equal(t, "bar", v)
	m = m.Delete("foo")
	assert.Equal(t, 1, m.Len())
	_, ok = m.Get("foo")
	assert.False(t, ok)
	v, ok = m.Get("qux")
	assert.True(t, ok)
	assert.Equal(t, "quux", v)
}

func TestOrderedMap_KeyTypes(t *testing.T) {
	var m *OrderedMap

	for _, keys := range [][]interface{}{
		{int(1), int(2)},
		{int8(1), int8(2)},
		{int16(1), int16(2)},
		{int32(1), int32(2)},
		{int64(1), int64(2)},
		{uint(1), uint(2)},
		{uint8(1), uint8(2)},
		{uint16(1), uint16(2)},
		{uint32(1), uint32(2)},
		{uint64(1), uint64(2)},
		{uintptr(1), uintptr(2)},
		{float32(1), float32(2)},
		{float64(1), float64(2)},
		{"1", "2"},
	} {
		t.Run(fmt.Sprintf("%T", keys[0]), func(t *testing.T) {
			assert.NotPanics(t, func() {
				kv := m.Set(keys[0], 1).Set(keys[1], 2).Min()
				assert.Equal(t, keys[0], kv.Key())
				assert.Equal(t, keys[1], kv.Next().Key())
			})
		})
	}

	t.Run("struct", func(t *testing.T) {
		assert.Panics(t, func() {
			m.Set(struct{}{}, 1)
		})
	})
}

func TestOrderedMap_Delete(t *testing.T) {
	var m *OrderedMap
	for i := 0; i < 50; i++ {
		m = m.Set(i, i)
		require.NoError(t, m.invariant())
		for j := 0; j <= i; j++ {
			m2 := m.Delete(j)
			require.NoError(t, m2.invariant(), fmt.Sprintf("i=%v,j=%v", i, j))
			k := 0
			for kv := m2.Min(); kv != nil; kv = kv.Next() {
				if k == j {
					k++
				}
				assert.Equal(t, k, kv.Key(), fmt.Sprintf("i=%v,j=%v", i, j))
				assert.Equal(t, k, kv.Value(), fmt.Sprintf("i=%v,j=%v", i, j))
				k++
			}
		}
	}
}

func TestOrderedMap_MinAfter(t *testing.T) {
	var m *OrderedMap
	for i := 0; i < 40; i += 2 {
		m = m.Set(i, i)
		assert.Nil(t, m.MinAfter(i))
		for j := -1; j < i; j++ {
			kv := m.MinAfter(j)
			require.NotNil(t, kv, fmt.Sprintf("i=%v,j=%v", i, j))
			expected := (j + 1) + ((j + 1) % 2)
			assert.Equal(t, expected, kv.Key())
			if expected+2 <= i {
				assert.Equal(t, expected+2, kv.Next().Key())
			}
		}
	}
}

func TestOrderedMap_MaxBefore(t *testing.T) {
	var m *OrderedMap
	for i := 0; i < 40; i += 2 {
		m = m.Set(i, i)
		assert.Nil(t, m.MaxBefore(0))
		for j := 1; j <= i+1; j++ {
			kv := m.MaxBefore(j)
			require.NotNil(t, kv, fmt.Sprintf("i=%v,j=%v", i, j))
			expected := (j - 1) - ((j + 1) % 2)
			assert.Equal(t, expected, kv.Key())
			if expected+2 <= i {
				assert.Equal(t, expected+2, kv.Next().Key())
			}
		}
	}
}

func TestOrderedMap_Iteration(t *testing.T) {
	var m *OrderedMap
	assert.Nil(t, m.Min())

	for i := 0; i < 1000; i++ {
		m = m.Set(i, i*2)
	}

	e := m.Min()
	for i := 0; i < 1000; i++ {
		assert.NotNil(t, e)
		assert.Equal(t, i, e.Key())
		assert.Equal(t, i*2, e.Value())
		assert.Equal(t, i, e.CountLess())
		assert.Equal(t, 1000-i-1, e.CountGreater())
		e = e.Next()
	}
	assert.Nil(t, e)

	e = m.Max()
	for i := 999; i >= 0; i-- {
		assert.NotNil(t, e)
		assert.Equal(t, i, e.Key())
		assert.Equal(t, i*2, e.Value())
		e = e.Prev()
	}
	assert.Nil(t, e)
}

func TestOrderedMap_Fuzz(t *testing.T) {
	ref := make(map[int]int)
	var m *OrderedMap
	assert.True(t, m.Empty())
	for i := 0; i < 100000; i++ {
		k := rand.Intn(500)
		if rand.Intn(3) == 0 {
			delete(ref, k)
			m = m.Delete(k)
			assert.Equal(t, len(ref), m.Len(), "after delete")
			require.NoError(t, m.invariant(), "after delete")
		} else {
			v := rand.Int()
			ref[k] = v
			m = m.Set(k, v)
			assert.Equal(t, len(ref), m.Len(), "after set")
			require.NoError(t, m.invariant(), "after set")
		}
	}
	for k, refv := range ref {
		v, ok := m.Get(k)
		assert.True(t, ok)
		assert.Equal(t, refv, v)
	}
}

var orderedMapValueResult interface{}

func BenchmarkOrderedMap_Get(b *testing.B) {
	for _, n := range []int{100, 10000, 1000000} {
		m := &OrderedMap{}
		for i := 0; i < n; i++ {
			m = m.Set(i, "foo")
		}
		b.Run(fmt.Sprintf("n=%v", n), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				v, _ := m.Get(i % n)
				orderedMapValueResult = v
			}
		})
	}
}

var orderedMapResult *OrderedMap

func BenchmarkOrderedMap_Set(b *testing.B) {
	for _, n := range []int{100, 10000, 1000000} {
		m := &OrderedMap{}
		for i := 0; i < n; i++ {
			m = m.Set(i, "foo")
		}
		b.Run(fmt.Sprintf("n=%v", n), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				orderedMapResult = m.Set(i%n, "bar")
			}
		})
	}
}

func (m *OrderedMap) invariant() error {
	_, err := m.invariantInfo()
	return err
}

type orderedMapInvariantInfo struct {
	BlackDepth int
}

func (m *OrderedMap) invariantInfo() (*orderedMapInvariantInfo, error) {
	if m == nil {
		return &orderedMapInvariantInfo{
			BlackDepth: 0,
		}, nil
	}

	if m == doubleBlackLeaf {
		return nil, fmt.Errorf("double black leaf")
	}
	if m.color != orderedMapRed && m.color != orderedMapBlack {
		return nil, fmt.Errorf("invalid node color: %v", m.color)
	}
	if m.key == nil {
		return nil, fmt.Errorf("nil key")
	}
	if m.color == orderedMapRed && ((m.left != nil && m.left.color == orderedMapRed) || (m.right != nil && m.right.color == orderedMapRed)) {
		return nil, fmt.Errorf("red node has red child")
	}

	left, err := m.left.invariantInfo()
	if err != nil {
		return nil, err
	}

	right, err := m.right.invariantInfo()
	if err != nil {
		return nil, err
	}

	if left.BlackDepth != right.BlackDepth {
		return nil, fmt.Errorf("unbalanced black depths")
	}

	info := &orderedMapInvariantInfo{
		BlackDepth: left.BlackDepth,
	}
	if m.color == orderedMapBlack {
		info.BlackDepth++
	}

	return info, nil
}
