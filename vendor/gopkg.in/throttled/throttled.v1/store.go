package throttled

import (
	"errors"
	"time"
)

// The error returned if the key does not exist in the Store.
var ErrNoSuchKey = errors.New("throttled: no such key")

// Store is the interface to implement to store the RateLimit state (number
// of requests per key, time-to-live or creation timestamp).
type Store interface {
	// Incr increments the count for the specified key and returns the new value along
	// with the number of seconds remaining. It may return an error
	// if the operation fails.
	//
	// The method may return ErrNoSuchKey if the key to increment does not exist,
	// in which case Reset will be called to initialize the value.
	Incr(string, time.Duration) (int, int, error)

	// Reset resets the key to 1 with the specified window duration. It must create the
	// key if it doesn't exist. It returns an error if it fails.
	Reset(string, time.Duration) error
}

// RemainingSeconds is a helper function that returns the number of seconds
// remaining from an absolute timestamp in UTC.
func RemainingSeconds(ts time.Time, window time.Duration) int {
	return int((window - time.Now().UTC().Sub(ts)).Seconds())
}
