// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"time"
)

// ProgressiveRetry executes a BackoffOperation and waits an increasing time before retrying the operation.
func ProgressiveRetry(operation func() error, backoffTimeouts []time.Duration) error {
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
