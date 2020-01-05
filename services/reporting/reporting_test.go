// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package reporting

import (
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/stretchr/testify/assert"
)

type TestingError struct {
	msg string
}

func (e TestingError) Error() string {
	return e.msg
}

type TestingTransport struct {
	flushes chan time.Duration
}

func (t TestingTransport) Flush(timeout time.Duration) bool {
	t.flushes <- timeout
	return true
}

func (t TestingTransport) Configure(options sentry.ClientOptions) {}

func (t TestingTransport) SendEvent(event *sentry.Event) {}

type TestingEnvironment struct {
	events  chan *sentry.Event
	flushes chan time.Duration
}

func InitForTesting() TestingEnvironment {
	events := make(chan *sentry.Event, 1)
	flushes := make(chan time.Duration, 1)
	transport := TestingTransport{flushes}
	opts := sentry.ClientOptions{}
	opts.Transport = transport
	opts.BeforeSend = func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
		events <- event
		return event
	}
	sentry.Init(opts)

	return TestingEnvironment{events, flushes}
}

// Reporting an error should capture its error message.
func TestCaptureException(t *testing.T) {
	env := InitForTesting()
	eventID := (*sentry.EventID) (CaptureException(TestingError{"some error"}))
	event := <-env.events
	lastEventID := &event.EventID
	eventErrorMsg := event.Exception[0].Value

	assert.Equal(t, eventID, lastEventID, "Returned event id should be the same as reported event id.")
	assert.Equal(t, "some error", eventErrorMsg, "Event error message should be the same as the message of the captured error.")
}

// Reporting a recovered panic should capture the panic message and
// have level: fatal
func TestRecover(t *testing.T) {
	env := InitForTesting()
	func() {
		defer Recover()
		panic("some panic")
	}()

	event := <-env.events
	assert.EqualValues(t, "some panic", event.Message, "Event message should be the same as panic message.")
	assert.EqualValues(t, "fatal", event.Level, "Event level should be fatal in the case of panic exceptions.")
}

// Flushing should call the appropriate transport Flush method with
// the given timeout.
func TestFlush(t *testing.T) {
	timeout := 5 * time.Second
	env := InitForTesting()
	CaptureException(TestingError{"some error"})
	Flush(timeout)
	transportTimeout := <-env.flushes

	assert.Equal(t, timeout, transportTimeout, "Timeout passed to client transport should be the same passed to Flush.")
}
