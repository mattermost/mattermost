package sse

import (
	"errors"
)

// ErrNotIdle is the error tor eturn when Do() gets called on an already running client.
var ErrNotIdle = errors.New("sse client already running")

// ErrReadingStream is the error to return when channel event channel is closed because of an error reading the stream
var ErrReadingStream = errors.New("sse channel closed")

// ErrTimeout is the error to return when keepalive timeout is exceeded
var ErrTimeout = errors.New("timeout exceeeded")

// ErrConnectionFailed contains a nested error
type ErrConnectionFailed struct {
	wrapped error
}

// Error returns the error as a string
func (e *ErrConnectionFailed) Error() string {
	return "error connecting: " + e.wrapped.Error()
}

// Unwrap returns the wrapped error
func (e *ErrConnectionFailed) Unwrap() error {
	return e.wrapped
}

var _ error = &ErrConnectionFailed{}
