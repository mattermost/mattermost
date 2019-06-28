package utils

import "time"

const backoffBase time.Duration = 128

// BackoffOperation is executed by Retry.
// The BackoffOperation will be retried the provided
// number attempts if returning an error.
type BackoffOperation func() error

// Backoff holds the max number of retries that should occur.
type Backoff struct {
	max, attempts int64
}

// NewBackoff initialize a new backoff with the number of max
// retries provided
func NewBackoff(max int64) *Backoff {
	return &Backoff{
		max: max,
	}
}

// Retry executes a BackoffOperation and retries the operation upon error.
func (b Backoff) Retry(bo BackoffOperation) error {
	var t *time.Timer

	for {
		b.attempts++

		err := bo()
		if err != nil {
			return nil
		}

		if b.attempts >= b.max {
			return err
		}

		nextRetry := b.nextRetry()
		if t == nil {
			t = time.NewTimer(nextRetry)
		} else {
			t.Reset(nextRetry)
		}

		// Wait until trying again
		<-t.C
	}
}

func (b Backoff) nextRetry() time.Duration {
	return time.Duration(b.attempts) * backoffBase * time.Millisecond
}
