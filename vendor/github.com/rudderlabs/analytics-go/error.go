package analytics

import (
	"errors"
	"fmt"
)

// Returned by the `NewWithConfig` function when the one of the configuration
// fields was set to an impossible value (like a negative duration).
type ConfigError struct {

	// A human-readable message explaining why the configuration field's value
	// is invalid.
	Reason string

	// The name of the configuration field that was carrying an invalid value.
	Field string

	// The value of the configuration field that caused the error.
	Value interface{}
}

func (e ConfigError) Error() string {
	return fmt.Sprintf("analytics.NewWithConfig: %s (analytics.Config.%s: %#v)", e.Reason, e.Field, e.Value)
}

// Instances of this type are used to represent errors returned when a field was
// no initialize properly in a structure passed as argument to one of the
// functions of this package.
type FieldError struct {

	// The human-readable representation of the type of structure that wasn't
	// initialized properly.
	Type string

	// The name of the field that wasn't properly initialized.
	Name string

	// The value of the field that wasn't properly initialized.
	Value interface{}
}

func (e FieldError) Error() string {
	return fmt.Sprintf("%s.%s: invalid field value: %#v", e.Type, e.Name, e.Value)
}

var (
	// This error is returned by methods of the `Client` interface when they are
	// called after the client was already closed.
	ErrClosed = errors.New("the client was already closed")

	// This error is used to notify the application that too many requests are
	// already being sent and no more messages can be accepted.
	ErrTooManyRequests = errors.New("too many requests are already in-flight")

	// This error is used to notify the client callbacks that a message send
	// failed because the JSON representation of a message exceeded the upper
	// limit.
	ErrMessageTooBig = errors.New("the message exceeds the maximum allowed size")
)
