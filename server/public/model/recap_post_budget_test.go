// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRecapPostBudget(t *testing.T) {
	tests := []struct {
		name             string
		maxPostsPerRecap int
		maxPostsPerDay   int
		usedToday        int64
		reserveN         int
		wantGranted      int
	}{
		{"per-recap binds", 50, UnlimitedValue, 0, 100, 50},
		{"per-day binds", 500, 10, 4, 100, 6},
		{"min of both", 5, 100, 90, 100, 5},
		{"day exhausted clamps to zero", 500, 10, 10, 100, 0},
		{"day overdrawn clamps to zero", 500, 10, 25, 100, 0},
		{"both unlimited grants in full", UnlimitedValue, UnlimitedValue, 0, 100, 100},
		{"unlimited ignores usedToday", UnlimitedValue, UnlimitedValue, 999999, 7, 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			budget := NewRecapPostBudget(tt.maxPostsPerRecap, tt.maxPostsPerDay, tt.usedToday)
			require.NotNil(t, budget)
			assert.Equal(t, tt.wantGranted, budget.Reserve(tt.reserveN))
		})
	}
}

func TestRecapPostBudgetReserve(t *testing.T) {
	t.Run("finite budget grants full then partial then zero", func(t *testing.T) {
		budget := NewRecapPostBudget(10, UnlimitedValue, 0)
		assert.Equal(t, 7, budget.Reserve(7))
		assert.Equal(t, 3, budget.Reserve(7))
		assert.Equal(t, 0, budget.Reserve(7))
	})

	t.Run("non-positive reservations do not drain", func(t *testing.T) {
		budget := NewRecapPostBudget(10, UnlimitedValue, 0)
		assert.Equal(t, 0, budget.Reserve(0))
		assert.Equal(t, 0, budget.Reserve(-5))
		assert.Equal(t, 10, budget.Reserve(10))
	})

	t.Run("unlimited budget repeatedly grants in full", func(t *testing.T) {
		budget := NewRecapPostBudget(UnlimitedValue, UnlimitedValue, 0)
		assert.Equal(t, 9, budget.Reserve(9))
		assert.Equal(t, 9, budget.Reserve(9))
	})
}

func TestRecapPostBudgetRefund(t *testing.T) {
	t.Run("refund restores unused reservation", func(t *testing.T) {
		budget := NewRecapPostBudget(10, UnlimitedValue, 0)
		require.Equal(t, 10, budget.Reserve(10))
		budget.Refund(4)
		assert.Equal(t, 4, budget.Reserve(10))
	})

	t.Run("non-positive refunds are no-ops", func(t *testing.T) {
		budget := NewRecapPostBudget(10, UnlimitedValue, 0)
		require.Equal(t, 10, budget.Reserve(10))
		budget.Refund(0)
		budget.Refund(-3)
		assert.Equal(t, 0, budget.Reserve(1))
	})

	t.Run("unlimited refund is a no-op", func(t *testing.T) {
		budget := NewRecapPostBudget(UnlimitedValue, UnlimitedValue, 0)
		budget.Refund(100)
		assert.Equal(t, 7, budget.Reserve(7))
	})
}

func TestRecapPostBudgetConcurrentReserveRefund(t *testing.T) {
	budget := NewRecapPostBudget(1000, UnlimitedValue, 0)
	var consumed atomic.Int64
	var wg sync.WaitGroup

	for range 32 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 200 {
				granted := budget.Reserve(7)
				if granted == 0 {
					continue
				}
				keep := granted / 2
				budget.Refund(granted - keep)
				consumed.Add(int64(keep))
			}
		}()
	}
	wg.Wait()

	drained := 0
	for {
		granted := budget.Reserve(1000)
		if granted == 0 {
			break
		}
		drained += granted
	}

	assert.EqualValues(t, 1000, consumed.Load()+int64(drained))
	assert.LessOrEqual(t, consumed.Load(), int64(1000))
}
