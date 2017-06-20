// this is a new logger interface for mattermost

package utils

import (
	"context"
	"encoding/json"

	l4g "github.com/alecthomas/log4go"
)

// this pattern allows us to "mock" the underlying l4g code when unit testing
var debug = l4g.Debug
var info = l4g.Info
var err = l4g.Error

// contextKey lets us add contextual information to log messages
type contextKey string

func (c contextKey) String() string {
	return string(c)
}

const contextKeyUserID contextKey = contextKey("user-id")
const contextKeyRequestID contextKey = contextKey("request-id")

// any contextKeys added to this array will be serialized in every log message
var contextKeys = [2]contextKey{contextKeyUserID, contextKeyRequestID}

// WithUserID adds a user id to the specified context. If the returned Context is subsequently passed to a logging
// method, the user id will automatically be included in the logged message
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, contextKeyUserID, userID)
}

// WithRequestID adds a request id to the specified context. If the returned Context is subsequently passed to a logging
// method, the request id will automatically be included in the logged message
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, contextKeyRequestID, requestID)
}

// extracts known contextKey values from the specified Context and assembles them into the returned map
func serializeContext(ctx context.Context) map[string]string {
	serialized := make(map[string]string)
	for _, key := range contextKeys {
		value, ok := ctx.Value(key).(string)
		if ok {
			serialized[string(key)] = value
		}
	}
	return serialized
}

// creates a JSON representation of a log message
func serializeLogMessage(ctx context.Context, message string) string {
	bytes, err := json.Marshal(&struct {
		Context map[string]string `json:"context"`
		Message string            `json:"message"`
	}{
		serializeContext(ctx),
		message,
	})
	if err != nil {
		// what to do?
	}
	return string(bytes)
}

// Debug logs a debug level message
func Debug(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	closure := func() string {
		return serializeLogMessage(ctx, message)
	}
	debug(closure)
}

// Info logs an info level message
func Info(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	closure := func() string {
		return serializeLogMessage(ctx, message)
	}
	info(closure)
}

// Error logs an error level message
func Error(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	closure := func() string {
		return serializeLogMessage(ctx, message)
	}
	err(closure)
}
