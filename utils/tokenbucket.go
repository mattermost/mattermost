// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"math"
	"sync"
	"time"

	clk "github.com/benbjohnson/clock"
)

// Bucket implements a token bucket interface. TODO(gsagula): Although it should be fairly precise, note that this library
// has not been tested for accuracy.
type Bucket struct {
	burst  chan struct{}
	close  chan struct{}
	closed bool
	rate   time.Duration
	last   time.Time
	once   sync.Once
	clock  clk.Clock
}

// NewTokenBucket returns a pointer to a token bucket's instance and a done func. Done() should be called when the bucket
// is no longer needed. Duration parameter sets the constant refill rate of one token per duration (how long a token takes
// to get back to the bucket). Burst sets the bucket's capacity.
func NewTokenBucket(duration time.Duration, burst uint64) (bucket *Bucket, done func()) {
	return NewTokenBucketWithClock(duration, burst, nil)
}

// NewTokenBucketWithClock is exactly like NewTokenBucket except that it takes a clock interface for testing. When clock is
// nil, a real clock instance will be supplied to the Bucket.
func NewTokenBucketWithClock(duration time.Duration, burst uint64, clock clk.Clock) (bucket *Bucket, done func()) {
	if clock == nil {
		clock = clk.New()
	}

	if duration.Nanoseconds() <= 0 {
		duration = 1 * time.Nanosecond
	}

	b := &Bucket{
		burst:  make(chan struct{}, burst),
		close:  make(chan struct{}),
		closed: false,
		rate:   duration,
		last:   clock.Now(),
		clock:  clock,
	}

	// It loads the burst channel by making tokens mediately available in the buffer.
	for i := uint64(0); i < burst; i++ {
		b.burst <- struct{}{}
	}

	// Routine that refills the bucket at constant rate (token/thick).
	go func(b *Bucket) {
		ticker := b.clock.Ticker(b.rate)
		for {
			select {
			case <-b.close:
				ticker.Stop()
				return
			case b.last = <-ticker.C:
				b.burst <- struct{}{}
			}
		}
	}(b)

	return b, b.done
}

// Take returns a token if any is available, otherwise it blocks until at least one token
// is returned to the bucket. This function will return an error if called after Done().
func (b *Bucket) Take() (err error) {
	if b.closed {
		return errors.New("bucket is closed")
	}
	// Blocks if burst channel is empty.
	<-b.burst
	return nil
}

// Until returns the approximated duration until the a token is available in the bucket. If buffer is
// not empty, this function return duration 0. This function returns error if when called after Done().
func (b *Bucket) Until() (duration time.Duration, err error) {
	if b.closed {
		return time.Duration(math.MaxInt64), errors.New("bucket is closed")
	}
	if d := b.rate - time.Since(b.last); d.Nanoseconds() > 0 {
		return d, nil
	}
	return time.Duration(0), nil
}

func (b *Bucket) done() {
	b.once.Do(func() {
		close(b.close)
		b.closed = true
	})
}
