package drivers

import (
	"context"
	"errors"
	"math/rand"
	"time"
)

const (
	// MutexTableName is the name being used for the mutex table
	MutexTableName = "db_lock"

	// minWaitInterval is the minimum amount of time to wait between locking attempts
	minWaitInterval = 1 * time.Second

	// maxWaitInterval is the maximum amount of time to wait between locking attempts
	maxWaitInterval = 5 * time.Minute

	// pollWaitInterval is the usual time to wait between unsuccessful locking attempts
	pollWaitInterval = 1 * time.Second

	// jitterWaitInterval is the amount of jitter to add when waiting to avoid thundering herds
	jitterWaitInterval = minWaitInterval / 2

	// TTL is the interval after which a locked mutex will expire unless refreshed
	TTL = time.Second * 15

	// RefreshInterval is the interval on which the mutex will be refreshed when locked
	RefreshInterval = TTL / 2
)

// MakeLockKey returns the prefixed key used to namespace mutex keys.
func MakeLockKey(key string) (string, error) {
	if key == "" {
		return "", errors.New("must specify valid mutex key")
	}

	return key, nil
}

// NextWaitInterval determines how long to wait until the next lock retry.
func NextWaitInterval(lastWaitInterval time.Duration, err error) time.Duration {
	nextWaitInterval := lastWaitInterval

	if nextWaitInterval <= 0 {
		nextWaitInterval = minWaitInterval
	}

	if err != nil {
		nextWaitInterval *= 2
		if nextWaitInterval > maxWaitInterval {
			nextWaitInterval = maxWaitInterval
		}
	} else {
		nextWaitInterval = pollWaitInterval
	}

	// Add some jitter to avoid unnecessary collision between competing other instances.
	nextWaitInterval += time.Duration(rand.Int63n(int64(jitterWaitInterval)) - int64(jitterWaitInterval)/2)

	return nextWaitInterval
}

type Locker interface {
	// Lock locks m unless the context is canceled. If the mutex is already locked by any other
	// instance, including the current one, the calling goroutine blocks until the mutex can be locked,
	// or the context is canceled.
	//
	// The mutex is locked only if a nil error is returned.
	Lock(ctx context.Context) error
	Unlock() error
}

type Lockable interface {
	DriverName() string
}

// IsLockable returns whether the given instance satisfies
// drivers.Lockable or not.
func IsLockable(x interface{}) bool {
	_, ok := x.(Lockable)
	return ok
}
