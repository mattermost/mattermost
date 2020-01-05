// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package reporting

import (
	"time"

	"github.com/getsentry/sentry-go"
)

// Options that configures the error reporting client.
type Options struct {
	// The DSN to use. If is not set, the error reporting is effectively disabled.
	Dsn string
	// In debug mode, the debug information is printed to stdout.
	Debug bool
	// The server name to be reported.
	ServerName string
	// The release to be sent with events.
	Release string
	// The dist to be sent with events.
	Dist string
	// The environment to be sent with events.
	Environment string
}

// ID of the event sent to the reporting service.
type EventID sentry.EventID

// Initialize the reporting services.
func Init(options Options) error {
	return sentry.Init(getSentryOptions(options))
}

// Capture an error and report it.
func CaptureException(err error) *EventID {
	return (*EventID) (sentry.CaptureException(err))
}

// Notify when all the buffered events have been sent by returning
// `true` or `false` if timeout was reached.
func Flush(timeout time.Duration) bool {
	return sentry.Flush(timeout)
}

// Capture a panic error and report it.
func Recover() *EventID {
	if err := recover(); err != nil {
		hub := sentry.CurrentHub()
		return (*EventID) (hub.Recover(err))
	}
	return nil
}

// Convert from Options to sentry.ClientOptions
func getSentryOptions(options Options) sentry.ClientOptions {
	return sentry.ClientOptions{
		Dsn: options.Dsn,
		Debug: options.Debug,
		ServerName: options.ServerName,
		Release: options.Release,
		Dist: options.Dist,
		Environment: options.Environment,
	}
}
