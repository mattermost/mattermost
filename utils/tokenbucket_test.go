// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type TestCase struct {
	rate         time.Duration
	burst        uint64
	calls        int
	minTotalTime time.Duration
}

// TODO(gsagula): Add a verification step that compares the waiting time with an acceptable
// marginal error. It should just logs a warning but not fail.
func CallBucket(t *testing.T, name string, tc TestCase) {
	b, done := NewTokenBucket(tc.rate, tc.burst)
	defer done()
	t.Run(name, func(t *testing.T) {
		startTotalTime := time.Now()
		for i := 0; i <= tc.calls; i++ {
			untilTime, err := b.Until()
			assert.NoError(t, err)
			if i >= int(tc.burst) {
				// Min waiting time per call will be close to rate when bucket is empty.
				assert.GreaterOrEqual(t, tc.rate.Nanoseconds(), untilTime.Nanoseconds(),
					"Until() cannot return a duration greater than (refill rate) %v, but it was %v",
					tc.rate, untilTime, untilTime-tc.rate)
			}
			b.Take()
		}
		totalTime := time.Since(startTotalTime)
		assert.GreaterOrEqual(t, totalTime.Nanoseconds(), tc.minTotalTime.Nanoseconds(),
			"Until() cannot return a duration greater than (refill rate) %v, but it was %v",
			tc.minTotalTime, totalTime, totalTime-tc.minTotalTime)
	})
}

func TestTokenBucket(t *testing.T) {
	const (
		// MSecond represents 1 millisecond.
		Millisecond = 1 * time.Millisecond
		// Microsecond represents 1 microsecond.
		Microsecond = 1 * time.Microsecond
	)
	t.Run("test bucket's acceptance when", func(t *testing.T) {
		tcs := map[string]TestCase{
			"rate is in milliseconds": {
				rate:         Millisecond,
				burst:        0,
				calls:        1e3,
				minTotalTime: 1e3 * Millisecond,
			},
			"rate is in milliseconds with burst": {
				rate:         Millisecond,
				burst:        10,
				calls:        1e3,
				minTotalTime: 1e3*Millisecond - 10*Millisecond,
			},
			"rate is in microseconds": {
				rate:         Microsecond,
				burst:        0,
				calls:        1e5,
				minTotalTime: 1e5 * Microsecond,
			},
			"rate is in microseconds with burst": {
				rate:         Microsecond,
				burst:        20,
				calls:        1e5,
				minTotalTime: 1e5*Microsecond - 20*Microsecond,
			},
			"calling Take() after Done()": {
				rate:         Microsecond,
				burst:        20,
				calls:        1e5,
				minTotalTime: 1e5*Microsecond - 20*Microsecond,
			},
		}
		for n, tc := range tcs {
			CallBucket(t, n, tc)
		}

		t.Run("test calling take after done", func(t *testing.T) {
			b, done := NewTokenBucket(1*time.Nanosecond, 1)
			done()
			assert.Error(t, b.Take())
		})

		t.Run("test calling until after done", func(t *testing.T) {
			b, done := NewTokenBucket(1*time.Nanosecond, 1)
			done()
			_, err := b.Until()
			assert.Error(t, err)
		})
	})
}
