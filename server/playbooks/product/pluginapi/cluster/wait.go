// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"math/rand"
	"time"
)

const (
	// minWaitInterval is the minimum amount of time to wait between locking attempts
	minWaitInterval = 1 * time.Second

	// maxWaitInterval is the maximum amount of time to wait between locking attempts
	maxWaitInterval = 5 * time.Minute

	// pollWaitInterval is the usual time to wait between unsuccessful locking attempts
	pollWaitInterval = 1 * time.Second

	// jitterWaitInterval is the amount of jitter to add when waiting to avoid thundering herds
	jitterWaitInterval = minWaitInterval / 2
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
