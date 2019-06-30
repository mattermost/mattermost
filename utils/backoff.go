package utils

import (
	"time"
)

const backoffBase uint64 = 128

// BackoffOperation is executed by Retry.
// The BackoffOperation will be retried the provided
// number attempts if returning an error.
type BackoffOperation func() error

// Backoff holds the max number of retries that should occur.
type Backoff struct {
	max, attempts uint64
}

// NewBackoff initialize a new backoff with the number of max
// retries provided
func NewBackoff(max uint64) *Backoff {
	return &Backoff{
		max:      max,
		attempts: 0,
	}
}

// Retry executes a BackoffOperation and retries the operation upon error.
func (b *Backoff) Retry(bo BackoffOperation) error {
	var t *time.Timer

	for {
		err := bo()
		if err == nil {
			return nil
		}

		nextRetry := b.NextRetry()
		if t == nil {
			t = time.NewTimer(nextRetry)
		} else {
			t.Reset(nextRetry)
		}

		// Wait until trying again
		<-t.C

		b.attempts++
		if b.attempts >= b.max {
			return err
		}
	}
}

// NextRetry calculates the duration until next retry
// by bit shift left starting from 128 as base
func (b *Backoff) NextRetry() time.Duration {
	progressiveBackoff := time.Duration(backoffBase << (b.attempts))
	return progressiveBackoff * time.Millisecond
}
