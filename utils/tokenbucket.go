// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"math"
	"sync"
	"time"
)

// Bucket implements a token bucket interface. TODO(gsagula): Although it should be fairly precise,
// note that this library has not been tested for accuracy yet.
type Bucket struct {
	burst  chan struct{}
	close  chan struct{}
	closed bool
	rate   time.Duration
	last   time.Time
	once   sync.Once
}

// NewTokenBucket returns a pointer to a token bucket's instance and a done function. Done should be called when the bucket
// is no longer needed. Duration parameter sets the constant refill rate of one token per tick (how long a token takes
// to get back into the bucket). Burst sets the bucket's capacity.
func NewTokenBucket(duration time.Duration, burst uint64) (bucket *Bucket, done func()) {
	if duration.Nanoseconds() <= 0 {
		duration = 1 * time.Nanosecond
	}

	b := &Bucket{
		burst:  make(chan struct{}, burst),
		close:  make(chan struct{}),
		closed: false,
		rate:   duration,
		last:   time.Now(),
	}

	// It initiates the burst channel by making tokens mediately available in the buffer.
	for i := uint64(0); i < burst; i++ {
		b.burst <- struct{}{}
	}

	// Routine that refills the bucket at constant rate (token/thick).
	go func(b *Bucket) {
		ticker := time.NewTicker(b.rate)
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

// Take consumes a token from the bucket if any is available. If the bucket is empty, this function will
// block until at least one token is back into the bucket. This function will return an error if called
// after done.
func (b *Bucket) Take() (err error) {
	if b.closed {
		return errors.New("bucket is closed")
	}
	// Blocks if burst channel is empty.
	<-b.burst
	return nil
}

// Until returns the duration until a token is available in the bucket. If the bucket is
// not empty, this function returns duration 0. This function returns error if when called after done.
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
