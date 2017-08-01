// this is a new logger interface for mattermost

package logger

import (
	"context"
	"encoding/json"
	"runtime"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

// this pattern allows us to "mock" the underlying l4g code when unit testing
var debug = l4g.Debug
var info = l4g.Info
var err = l4g.Error

func init() {
	initL4g(utils.Cfg)
}

// listens for configuration changes that we might need to respond to
var configListenerID = utils.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
	info("Configuration change detected, reloading log settings")
	initL4g(newConfig)
})

// assumes that ../config.go::configureLog has already been called, and has in turn called l4g.close() to clean up
// any old filters that we might have previously created
func initL4g(config *model.Config) {
	// TODO: add support for newConfig.LogSettings.EnableConsole. Right now, ../config.go sets it up in its configureLog
	// method. If we also set it up here, messages will be written to the console twice. Eventually, when all instances
	// of l4g have been replaced by this logger, we can move that code to here

	if config.LogSettings.EnableFile {
		var fileFormat = config.LogSettings.FileFormat
		if fileFormat == "" {
			fileFormat = "[%D %T] [%L] %M"
		}

		level := l4g.DEBUG
		if config.LogSettings.FileLevel == "INFO" {
			level = l4g.INFO
		} else if config.LogSettings.FileLevel == "WARN" {
			level = l4g.WARNING
		} else if config.LogSettings.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		// TODO: use a different writer that formats the entire log message as a JSON object
		flw := l4g.NewFileLogWriter(utils.GetLogFileLocation(config.LogSettings.FileLocation)+".json", false)
		flw.SetFormat(fileFormat)
		flw.SetRotate(true)
		flw.SetRotateLines(utils.LOG_ROTATE_SIZE)
		l4g.AddFilter("file", level, flw)
	}
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

// returns the path to the next file up the callstack that has a different name than this file
// in other words, finds the path to the file that is doing the logging
// looks a maximum of 10 frames up the call stack to find a file that has a different name than this one
func getParentFilename() string {
	_, currentFilename, _, ok := runtime.Caller(0)
	if !ok {
		return "Unknown"
	}
	for i := 1; i < 10; i++ {
		_, parentFilename, _, ok := runtime.Caller(i)
		if !ok {
			return "Unkown"
		} else if parentFilename != currentFilename {
			return parentFilename
		}
	}
	return "Unknown"
}

// creates a JSON representation of a log message
func serializeLogMessage(ctx context.Context, message string) string {
	bytes, err := json.Marshal(&struct {
		Context map[string]string `json:"context"`
		Logger  string            `json:"logger"`
		Message string            `json:"message"`
	}{
		serializeContext(ctx),
		getParentFilename(),
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
	debug(func() string {
		return serializeLogMessage(ctx, message)
	})
}

// Info logs an info level message
func Info(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	info(func() string {
		return serializeLogMessage(ctx, message)
	})
}

// Error logs an error level message
func Error(ctx context.Context, message string) {
	// we need to serialize the message into a JSON object before logging it, but we only want to serialize it if we're
	// sure that it's going to be written, to avoid the overhead of needless serialization, so do the work in a closure
	err(func() string {
		return serializeLogMessage(ctx, message)
	})
}
