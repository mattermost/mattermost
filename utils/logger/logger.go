// this is a new logger interface for mattermost

package utils

import (
	"context"
	"encoding/json"
	"runtime"

	l4g "github.com/alecthomas/log4go"
)

// this pattern allows us to "mock" the underlying l4g code when unit testing
var debug = l4g.Debug
var info = l4g.Info
var err = l4g.Error

// Logger - an instance of the log framework that can be used to log messages
type Logger struct {
	filename string
}

// NewLogger - creates a new instance of Logger named after the file that created it
func NewLogger() Logger {
	_, file, _, ok := runtime.Caller(1)
	if ok {
		return Logger{file}
	}
	return Logger{"Unknown Logger"}
}

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
func (log Logger) WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, contextKeyUserID, userID)
}

// WithRequestID adds a request id to the specified context. If the returned Context is subsequently passed to a logging
// method, the request id will automatically be included in the logged message
func (log Logger) WithRequestID(ctx context.Context, requestID string) context.Context {
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
func serializeLogMessage(ctx context.Context, log Logger, message string) string {
	bytes, err := json.Marshal(&struct {
		Context map[string]string `json:"context"`
		Logger  string            `json:"logger"`
		Message string            `json:"message"`
	}{
		serializeContext(ctx),
		log.filename,
		message,
	})
	if err != nil {
		// what to do?
	}
	return string(bytes)
}

// Debug logs a debug level message
func (log Logger) Debug(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	debug(func() string {
		return serializeLogMessage(ctx, log, message)
	})
}

// Info logs an info level message
func (log Logger) Info(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	info(func() string {
		return serializeLogMessage(ctx, log, message)
	})
}

// Error logs an error level message
func (log Logger) Error(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	err(func() string {
		return serializeLogMessage(ctx, log, message)
	})
}
