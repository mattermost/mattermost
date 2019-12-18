// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package reporting

import (
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
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
	opts := Options()
	opts.Transport = transport
	opts.BeforeSend = func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
		events <- event
		return event
	}
	Init(opts)

	return TestingEnvironment{events, flushes}
}

// Reporting an error should capture its error message.
func TestCaptureException(t *testing.T) {
	env := InitForTesting()
	eventID := CaptureException(TestingError{"some error"})
	event := <-env.events
	lastEventID := &event.EventID

	if lastEventID != eventID {
		t.Error("Event IDs do not match.")
	}

	exception := event.Exception[0]
	if exception.Value != "some error" {
		t.Error("Exception message does not match error message.")
	}
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
	if event.Message != "some panic" {
		t.Error("Event message should match panic message.")
	}
	if event.Level != "fatal" {
		t.Error("Events in case of a panic should have level: fatal.")
	}
}

// Flushing should call the appropriate transport Flush method with
// the given timeout.
func TestFlush(t *testing.T) {
	env := InitForTesting()
	CaptureException(TestingError{"some error"})
	Flush(5 * time.Second)
	timeout := <-env.flushes

	if timeout != 5*time.Second {
		t.Error("Flush is not receiving the specified timeout.")
	}
}
