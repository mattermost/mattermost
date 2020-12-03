package logr

import "github.com/wiggin77/merror"

// timeoutError is returned from functions that can timeout.
type timeoutError struct {
	text string
}

// newTimeoutError returns a TimeoutError.
func newTimeoutError(text string) timeoutError {
	return timeoutError{text: text}
}

// IsTimeoutError returns true if err is a TimeoutError.
func IsTimeoutError(err error) bool {
	if _, ok := err.(timeoutError); ok {
		return true
	}
	// if a multi-error, return true if any of the errors
	// are TimeoutError
	if merr, ok := err.(*merror.MError); ok {
		for _, e := range merr.Errors() {
			if IsTimeoutError(e) {
				return true
			}
		}
	}
	return false
}

func (err timeoutError) Error() string {
	return err.text
}
