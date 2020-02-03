package cluster

import (
	"math/rand"
	"time"
)

// nextWaitInterval determines how long to wait until the next lock retry.
func nextWaitInterval(lastWaitInterval time.Duration, err error) time.Duration {
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

	// Add some jitter to avoid unnecessary collision between competing plugin instances.
	nextWaitInterval += time.Duration(rand.Int63n(int64(jitterWaitInterval)) - int64(jitterWaitInterval)/2)

	return nextWaitInterval
}
