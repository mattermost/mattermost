// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"math"
	"sync/atomic"
)

// RecapPostBudget is a job-local, concurrency-safe budget for how many posts a
// recap may still consume across all of its channels. It is computed once at
// recap-job start and shared by the goroutines processing the job's channels,
// which makes the per-recap post cap (MaxPostsPerRecap) exact under
// parallelism. The per-day component is a point-in-time snapshot, so
// MaxPostsPerDay remains approximate across concurrently running jobs of the
// same user (accepted by design).
//
// A nil *RecapPostBudget on RecapProcessingOptions means "no job-local
// budget": ProcessRecapChannelWithOptions then falls back to per-channel
// database recomputation (the pre-existing behavior).
type RecapPostBudget struct {
	unlimited bool
	remaining atomic.Int64
}

// NewRecapPostBudget builds a budget from the effective recap limits and the
// user's recap post usage so far today. A limit set to UnlimitedValue (-1) is
// ignored; when both limits are unlimited the budget grants every reservation
// in full. A negative computed remainder clamps to zero.
func NewRecapPostBudget(maxPostsPerRecap, maxPostsPerDay int, usedToday int64) *RecapPostBudget {
	perRecapEnabled := IsLimitEnabled(maxPostsPerRecap)
	perDayEnabled := IsLimitEnabled(maxPostsPerDay)
	if !perRecapEnabled && !perDayEnabled {
		return &RecapPostBudget{unlimited: true}
	}

	remaining := int64(math.MaxInt64)
	if perRecapEnabled {
		remaining = min(remaining, int64(maxPostsPerRecap))
	}
	if perDayEnabled {
		remaining = min(remaining, int64(maxPostsPerDay)-usedToday)
	}
	remaining = max(remaining, 0)

	budget := &RecapPostBudget{}
	budget.remaining.Store(remaining)
	return budget
}

// Reserve atomically takes up to n posts from the budget and returns how many
// were granted: 0 when the budget is exhausted (or n <= 0), n when the budget
// is unlimited, and min(n, remaining) otherwise.
func (b *RecapPostBudget) Reserve(n int) int {
	if n <= 0 {
		return 0
	}
	if b.unlimited {
		return n
	}
	for {
		current := b.remaining.Load()
		if current <= 0 {
			return 0
		}
		granted := min(int64(n), current)
		if b.remaining.CompareAndSwap(current, current-granted) {
			return int(granted)
		}
	}
}

// Refund returns unused posts from an earlier reservation to the budget.
// Callers must never refund more than they reserved from this budget; under
// that invariant the counter cannot exceed its initial value. n <= 0 is a
// no-op.
func (b *RecapPostBudget) Refund(n int) {
	if n <= 0 || b.unlimited {
		return
	}
	b.remaining.Add(int64(n))
}
