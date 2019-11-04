// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"github.com/stretchr/testify/assert"
	"runtime"
	"testing"
	"time"

	clk "github.com/benbjohnson/clock"
)

// TODO(gsagula): write more robust tests.
func TestTokenBucket(t *testing.T) {
	type Result struct {
		Taken bool
		Err   error
	}

	take := func(b *Bucket, m *clk.Mock) (chan *Result, chan time.Duration) {
		r := make(chan *Result)
		d := make(chan time.Duration)
		go func() {
			for {
				select {
				case duration := <-d:
					m.Add(duration)
					if duration.Nanoseconds() > 0 {
						r <- &Result{
							Taken: true,
							Err:   b.Take(),
						}
					}
				default:
				}
			}
		}()
		runtime.Gosched()
		return r, d
	}

	t.Run("mocked clock", func(t *testing.T) {
		clock := clk.NewMock()
		clock.Now().UTC()
		tb := NewTokenBucketWithClock(1*time.Nanosecond, 2, clock)
		defer tb.Done()

		r, d := take(tb, clock)
		assert.NoError(t, tb.Take())
		assert.NoError(t, tb.Take())

		d <- 1 * time.Nanosecond
		ok := <-r
		assert.Equal(t, true, ok.Taken)
		assert.NoError(t, ok.Err)
	})

	t.Run("real clock", func(t *testing.T) {
		burst := uint64(3)
		refill := 10 * time.Millisecond
		tb := NewTokenBucket(refill, burst)
		for i := 0; i < int(burst); i++ {
			assert.NoError(t, tb.Take())
		}
		start := time.Now()
		assert.NoError(t, tb.Take())
		duration := time.Now().Sub(start)

		// Assert that Take() blocks.
		assert.GreaterOrEqual(t, duration.Nanoseconds(), refill.Nanoseconds())
	})
}
