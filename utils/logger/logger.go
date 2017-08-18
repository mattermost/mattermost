// this is a new logger interface for mattermost

package logger

import (
	"context"
	"encoding/json"
	"fmt"
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
		level := l4g.DEBUG
		if config.LogSettings.FileLevel == "INFO" {
			level = l4g.INFO
		} else if config.LogSettings.FileLevel == "WARN" {
			level = l4g.WARNING
		} else if config.LogSettings.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		// create a logger that writes JSON objects to a file, and override our log methods to use it
		flw := NewJSONFileLogger(level, utils.GetLogFileLocation(config.LogSettings.FileLocation)+".jsonl")
		debug = flw.Debug
		info = flw.Info
		err = flw.Error
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

func formatMessage(args ...interface{}) string {
	msg, ok := args[0].(string)
	if !ok {
		panic("Second argument is not of type string")
	}
	if len(args) > 1 {
		variables := args[1:]
		msg = fmt.Sprintf(msg, variables...)
	}
	return msg
}

// Debugc logs a debug level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Debugc(ctx context.Context, args ...interface{}) {
	debug(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Debugf logs a debug level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Debugf(args ...interface{}) {
	debug(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}

// Infoc logs an info level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Infoc(ctx context.Context, args ...interface{}) {
	info(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Infof logs an info level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Infof(args ...interface{}) {
	info(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}

// Errorc logs an error level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Errorc(ctx context.Context, args ...interface{}) {
	err(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Errorf logs an error level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Errorf(args ...interface{}) {
	err(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}
