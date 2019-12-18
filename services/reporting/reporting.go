// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package reporting

import (
	"time"

	"github.com/getsentry/sentry-go"
)

// Return the options that can be configured for the error reporting
// library.
func Options() sentry.ClientOptions {
	return sentry.ClientOptions{}
}

// Initialize the reporting services.
func Init(options sentry.ClientOptions) error {
	return sentry.Init(options)
}

// Capture an error and report it.
func CaptureException(err error) *sentry.EventID {
	return sentry.CaptureException(err)
}

// Notify when all the buffered events have been sent by returning
// `true` or `false` if timeout was reached.
func Flush(timeout time.Duration) bool {
	return sentry.Flush(timeout)
}

// Capture a panic error and report it.
func Recover() *sentry.EventID {
	if err := recover(); err != nil {
		hub := sentry.CurrentHub()
		return hub.Recover(err)
	}
	return nil
}
