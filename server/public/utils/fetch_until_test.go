// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type pagedSource struct {
	items []int
	reads int
}

func (s *pagedSource) fetch(perPage int) func(offset int) ([]int, error) {
	return func(offset int) ([]int, error) {
		s.reads++
		if offset >= len(s.items) {
			return nil, nil
		}
		end := min(offset+perPage, len(s.items))
		return s.items[offset:end], nil
	}
}

func advanceBy(offset int) func([]int) int {
	return func(page []int) int { return offset + len(page) }
}

func TestFetchUntil(t *testing.T) {
	seq := func(n int) []int {
		out := make([]int, n)
		for i := range out {
			out[i] = i
		}
		return out
	}
	keepAll := func(int) bool { return true }
	keepEven := func(v int) bool { return v%2 == 0 }

	t.Run("returns a full page when nothing is filtered", func(t *testing.T) {
		src := &pagedSource{items: seq(100)}
		got, truncated, err := FetchUntil(0, 10, src.fetch(10), keepAll, advanceBy(0))
		require.NoError(t, err)
		require.False(t, truncated)
		require.Equal(t, seq(10), got)
		require.Equal(t, 1, src.reads, "a page that needs no filling must cost one read")
	})

	t.Run("re-reads to fill a page whose items were filtered out", func(t *testing.T) {
		src := &pagedSource{items: seq(100)}
		got, truncated, err := FetchUntil(0, 10, src.fetch(10), keepEven, func(page []int) int {
			return page[len(page)-1] + 1
		})
		require.NoError(t, err)
		require.False(t, truncated)
		require.Len(t, got, 10, "a short page is how clients recognise the end of the results")
		require.Equal(t, []int{0, 2, 4, 6, 8, 10, 12, 14, 16, 18}, got)
		require.Equal(t, 2, src.reads)
	})

	t.Run("stops at a short page rather than looping", func(t *testing.T) {
		src := &pagedSource{items: seq(4)}
		got, truncated, err := FetchUntil(0, 10, src.fetch(10), keepEven, advanceBy(0))
		require.NoError(t, err)
		require.False(t, truncated, "an exhausted source is a genuine end of results")
		require.Equal(t, []int{0, 2}, got)
		require.Equal(t, 1, src.reads)
	})

	t.Run("reports truncation when the cap is hit with the page unfilled", func(t *testing.T) {
		src := &pagedSource{items: seq(10000)}
		got, truncated, err := FetchUntil(0, 10, src.fetch(10), func(int) bool { return false }, advanceBy(0))
		require.NoError(t, err)
		require.True(t, truncated, "the caller must be able to tell this apart from the end of results")
		require.Empty(t, got)
		require.Equal(t, FetchUntilMaxRounds, src.reads)
	})

	t.Run("surfaces a fetch error with whatever was kept", func(t *testing.T) {
		boom := errors.New("boom")
		got, truncated, err := FetchUntil(0, 10, func(int) ([]int, error) { return nil, boom }, keepAll, advanceBy(0))
		require.ErrorIs(t, err, boom)
		require.False(t, truncated)
		require.Empty(t, got)
	})

	t.Run("a non-positive page size reads nothing", func(t *testing.T) {
		src := &pagedSource{items: seq(100)}
		got, truncated, err := FetchUntil(0, 0, src.fetch(10), keepAll, advanceBy(0))
		require.NoError(t, err)
		require.False(t, truncated)
		require.Empty(t, got)
		require.Zero(t, src.reads)
	})
}
