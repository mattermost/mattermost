// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"time"
)

var backoffTimeouts = []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 400 * time.Millisecond}

var longBackoffTimeouts = []time.Duration{200 * time.Millisecond, 500 * time.Millisecond, 1 * time.Second, 2 * time.Second, 5 * time.Second, 10 * time.Second}

// ProgressiveRetry executes a BackoffOperation and waits an increasing time before retrying the operation.
func ProgressiveRetry(operation func() error) error {
	//var err error
	//
	//for attempts := 0; attempts < len(backoffTimeouts); attempts++ {
	//	err = operation()
	//	if err == nil {
	//		return nil
	//	}
	//
	//	time.Sleep(backoffTimeouts[attempts])
	//}
	//
	//return err

	return progressiveRetry(operation, backoffTimeouts)
}

func LongProgressiveRetry(operation func() error) error {
	//var err error
	//
	//for attempts := 0; attempts < len(backoffTimeouts); attempts++ {
	//	err = operation()
	//	if err == nil {
	//		return nil
	//	}
	//
	//	time.Sleep(backoffTimeouts[attempts])
	//}
	//
	//return err

	return progressiveRetry(operation, longBackoffTimeouts)
}

func progressiveRetry(operation func() error, timeouts []time.Duration) error {
	var err error

	for attempts := 0; attempts < len(timeouts); attempts++ {
		err = operation()
		if err == nil {
			return nil
		}

		time.Sleep(timeouts[attempts])
	}

	return err
}
