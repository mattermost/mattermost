// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"time"
)

var backoffTimeouts = []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 400 * time.Millisecond}

// ProgressiveRetry executes a BackoffOperation and retries the operation 3 times upon error.
func ProgressiveRetry(operation func() error) error {
	var t *time.Timer
	var attempts = 0

	for {
		err := operation()
		if err == nil {
			return nil
		}

		attempts++
		if attempts >= len(backoffTimeouts) {
			return err
		}

		nextRetry := backoffTimeouts[attempts]
		if t == nil {
			t = time.NewTimer(nextRetry)
		} else {
			t.Reset(nextRetry)
		}

		// Wait until timer is finished before trying again
		<-t.C
	}
}
