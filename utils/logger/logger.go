// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// this is a new logger interface for mattermost

package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime"

	l4g "github.com/alecthomas/log4go"

	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
)

// this pattern allows us to "mock" the underlying l4g code when unit testing
var logger l4g.Logger
var debugLog = l4g.Debug
var infoLog = l4g.Info
var errorLog = l4g.Error

func init() {
	// listens for configuration changes that we might need to respond to
	utils.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		infoLog("Configuration change detected, reloading log settings")
		initL4g(newConfig.LogSettings)
	})
	initL4g(utils.Cfg.LogSettings)
}

// assumes that ../config.go::configureLog has already been called, and has in turn called l4g.close() to clean up
// any old filters that we might have previously created
func initL4g(logSettings model.LogSettings) {
	// TODO: add support for newConfig.LogSettings.EnableConsole. Right now, ../config.go sets it up in its configureLog
	// method. If we also set it up here, messages will be written to the console twice. Eventually, when all instances
	// of l4g have been replaced by this logger, we can move that code to here
	if logSettings.EnableFile {
		level := l4g.DEBUG
		if logSettings.FileLevel == "INFO" {
			level = l4g.INFO
		} else if logSettings.FileLevel == "WARN" {
			level = l4g.WARNING
		} else if logSettings.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		// create a logger that writes JSON objects to a file, and override our log methods to use it
		if logger != nil {
			logger.Close()
		}
		logger = NewJSONFileLogger(level, utils.GetLogFileLocation(logSettings.FileLocation)+".jsonl")
		debugLog = logger.Debug
		infoLog = logger.Info
		errorLog = logger.Error
	}
}

// contextKey lets us add contextual information to log messages
type contextKey string

func (c contextKey) String() string {
	return string(c)
}

const contextKeyUserID contextKey = contextKey("user_id")
const contextKeyRequestID contextKey = contextKey("request_id")

// any contextKeys added to this array will be serialized in every log message
var contextKeys = [2]contextKey{contextKeyUserID, contextKeyRequestID}

// WithUserId adds a user id to the specified context. If the returned Context is subsequently passed to a logging
// method, the user id will automatically be included in the logged message
func WithUserId(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, contextKeyUserID, userID)
}

// WithRequestId adds a request id to the specified context. If the returned Context is subsequently passed to a logging
// method, the request id will automatically be included in the logged message
func WithRequestId(ctx context.Context, requestID string) context.Context {
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

// Returns the path to the next file up the callstack that has a different name than this file
// in other words, finds the path to the file that is doing the logging.
// Removes machine-specific prefix, so returned path starts with /mattermost-server.
// Looks a maximum of 10 frames up the call stack to find a file that has a different name than this one.
func getCallerFilename() (string, error) {
	_, currentFilename, _, ok := runtime.Caller(0)
	if !ok {
		return "", errors.New("Failed to traverse stack frame")
	}

	platformDirectory := currentFilename
	for filepath.Base(platformDirectory) != "platform" {
		platformDirectory = filepath.Dir(platformDirectory)
		if platformDirectory == "." || platformDirectory == string(filepath.Separator) {
			break
		}
	}

	for i := 1; i < 10; i++ {
		_, parentFilename, _, ok := runtime.Caller(i)
		if !ok {
			return "", errors.New("Failed to traverse stack frame")
		} else if parentFilename != currentFilename && strings.Contains(parentFilename, platformDirectory) {
			// trim parentFilename such that we return the path to parentFilename, relative to platformDirectory
			return parentFilename[strings.LastIndex(parentFilename, platformDirectory)+len(platformDirectory)+1:], nil
		}
	}
	return "", errors.New("Failed to traverse stack frame")
}

// creates a JSON representation of a log message
func serializeLogMessage(ctx context.Context, message string) string {
	callerFilename, err := getCallerFilename()
	if err != nil {
		callerFilename = "Unknown"
	}

	bytes, err := json.Marshal(&struct {
		Context map[string]string `json:"context"`
		File    string            `json:"file"`
		Message string            `json:"message"`
	}{
		serializeContext(ctx),
		callerFilename,
		message,
	})
	if err != nil {
		errorLog("Failed to serialize log message %v", message)
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

// Debugc logs a debugLog level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Debugc(ctx context.Context, args ...interface{}) {
	debugLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Debugf logs a debugLog level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Debugf(args ...interface{}) {
	debugLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}

// Infoc logs an infoLog level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Infoc(ctx context.Context, args ...interface{}) {
	infoLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Infof logs an infoLog level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Infof(args ...interface{}) {
	infoLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}

// Errorc logs an error level message, including context information that is stored in the first parameter.
// If two parameters are supplied, the second must be a message string, and will be logged directly.
// If more than two parameters are supplied, the second parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Errorc(ctx context.Context, args ...interface{}) {
	errorLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(ctx, msg)
	})
}

// Errorf logs an error level message.
// If one parameter is supplied, it must be a message string, and will be logged directly.
// If two or more parameters are specified, the first parameter must be a format string, and the remaining parameters
// must be the variables to substitute into the format string, following the convention of the fmt.Sprintf(...) function.
func Errorf(args ...interface{}) {
	errorLog(func() string {
		msg := formatMessage(args...)
		return serializeLogMessage(context.Background(), msg)
	})
}
