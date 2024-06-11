// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"time"
)

var shortBackoffTimeouts = []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 400 * time.Millisecond}

var longBackoffTimeouts = []time.Duration{500 * time.Millisecond, 1 * time.Second, 2 * time.Second, 5 * time.Second, 8 * time.Second, 10 * time.Second}

// ProgressiveRetry executes a BackoffOperation and waits an increasing time before retrying the operation.
func ProgressiveRetry(operation func() error) error {
	return CustomProgressiveRetry(operation, shortBackoffTimeouts)
}

func LongProgressiveRetry(operation func() error) error {
	return CustomProgressiveRetry(operation, longBackoffTimeouts)
}

func CustomProgressiveRetry(operation func() error, backoffTimeouts []time.Duration) error {
	var err error

	for attempts := 0; attempts < len(backoffTimeouts); attempts++ {
		err = operation()
		if err == nil {
			return nil
		}

		time.Sleep(backoffTimeouts[attempts])
	}

	return err
}
