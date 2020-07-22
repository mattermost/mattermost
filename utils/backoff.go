// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"time"
)

var backoffTimeouts = []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 400 * time.Millisecond}

// ProgressiveRetry executes a BackoffOperation and waits an increasing time before retrying the operation.
func ProgressiveRetry(operation func() error) error {
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
