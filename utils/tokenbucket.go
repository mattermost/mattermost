package utils

import (
	"errors"
	"sync"
	"time"

	clk "github.com/benbjohnson/clock"
)

// Bucket implements a token bucket interface. TODO(gsagula): Note that this library has not been tested for
// high performance use-cases yet.
type Bucket struct {
	burst  chan struct{}
	done   chan struct{}
	closed bool
	rate   time.Duration
	once   sync.Once
	clock  clk.Clock
}

// NewTokenBucket returns an instance of a token bucket. Duration parameter sets the refill rate, or how long a token takes
// to get back to the bucket. Burst sets the bucket's capacity.
func NewTokenBucket(duration time.Duration, burst uint64) *Bucket {
	return NewTokenBucketWithClock(duration, burst, nil)
}

// NewTokenBucketWithClock is exactly like NewTokenBucket except that it takes a clock interface for testing. When clock is
// nil, a real clock instance will be supplied to the Bucket.
func NewTokenBucketWithClock(duration time.Duration, burst uint64, clock clk.Clock) *Bucket {
	if clock == nil {
		clock = clk.New()
	}

	bucket := &Bucket{
		burst:  make(chan struct{}, burst),
		done:   make(chan struct{}),
		closed: false,
		rate:   duration,
		clock:  clock,
	}

	// It loads the burst channel.
	for i := uint64(0); i < burst; i++ {
		bucket.burst <- struct{}{}
	}

	// Routine that refills the bucket at constant rate.
	go func(b *Bucket) {
		if b.rate.Nanoseconds() <= 0 {
			for {
				select {
				case <-b.done:
					return
				default:
					b.burst <- struct{}{}
				}
			}
		} else {
			ticker := b.clock.Ticker(b.rate)
			for {
				select {
				case <-b.done:
					ticker.Stop()
					return
				case <-ticker.C:
					b.burst <- struct{}{}
				}
			}
		}
	}(bucket)
	return bucket
}

// Take will block until a token is removed from the bucket. Calling this function after Closed()
// will return an error.
func (b *Bucket) Take() error {
	if b.closed {
		return errors.New("bucket is closed")
	}
	<-b.burst
	return nil
}

// Done will stop the routine that refills the bucket.
func (b *Bucket) Done() {
	b.once.Do(func() {
		close(b.done)
		b.closed = true
	})
}
