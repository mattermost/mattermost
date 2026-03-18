package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAssertNotSameMap(t *testing.T) {
	t.Run("both nil maps are the same", func(t *testing.T) {
		mockT := &testing.T{}
		var a, b map[string]int

		AssertNotSameMap(mockT, a, b)
		require.True(t, mockT.Failed())
	})

	t.Run("one nil map is not the same", func(t *testing.T) {
		mockT := &testing.T{}
		var a map[string]int
		b := map[string]int{"key1": 1}

		AssertNotSameMap(mockT, a, b)
		require.False(t, mockT.Failed())
	})

	t.Run("different maps should not be the same", func(t *testing.T) {
		mockT := &testing.T{}
		a := map[string]int{"key1": 1}
		b := map[string]int{"key1": 1}

		AssertNotSameMap(mockT, a, b)
		require.False(t, mockT.Failed())
	})

	t.Run("same map should be the same", func(t *testing.T) {
		mockT := &testing.T{}
		a := map[string]int{"key1": 1}
		b := a

		AssertNotSameMap(mockT, a, b)
		require.True(t, mockT.Failed())
	})

	t.Run("same map should be the same after modification", func(t *testing.T) {
		mockT := &testing.T{}
		a := map[string]int{"key1": 1}
		b := a
		b["key2"] = 2

		AssertNotSameMap(mockT, a, b)
		require.True(t, mockT.Failed())
	})
}
