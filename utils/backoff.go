// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"time"
)

const (
	backoffBase uint64 = 128
	maxAttempts        = 4
)

// BackoffOperation is executed by Retry.
// The BackoffOperation will be retried the provided
// number attempts if returning an error.
type BackoffOperation func() error

// ProgressiveRetry executes a BackoffOperation and retries the operation 3 times upon error.
func ProgressiveRetry(bo BackoffOperation) error {
	var t *time.Timer
	var attempt uint64

	for {
		err := bo()
		if err == nil {
			return nil
		}

		nextRetry := NextRetry(attempt)
		if t == nil {
			t = time.NewTimer(nextRetry)
		} else {
			t.Reset(nextRetry)
		}

		attempt++
		if attempt >= maxAttempts {
			return err
		}

		// Wait until timer is finished before trying again
		<-t.C
	}
}

// NextRetry calculates the duration until next retry
// by bit shift left starting from 128 as base
func NextRetry(attempt uint64) time.Duration {
	progressiveBackoff := time.Duration(backoffBase << attempt)
	return progressiveBackoff * time.Millisecond
}
