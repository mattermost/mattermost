// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package logger

import (
	"fmt"
	"maps"
	"time"

	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/common"
)

type defaultLogger struct {
	logContext LogContext
	logAPI     common.LogAPI
}

/*
New creates a new logger.

- api: LogAPI implementation
*/
func New(api common.LogAPI) Logger {
	l := &defaultLogger{
		logAPI: api,
	}
	return l
}

func (l *defaultLogger) With(logContext LogContext) Logger {
	newLogger := *l
	newLogger.logContext = cloneContext(l.logContext)
	maps.Copy(newLogger.logContext, logContext)
	return &newLogger
}

func (l *defaultLogger) WithError(err error) Logger {
	newLogger := *l
	newLogger.logContext = cloneContext(l.logContext)
	newLogger.logContext[ErrorKey] = err.Error()
	return &newLogger
}

// cloneContext returns a copy, so derived loggers never write into the parent map
// that other goroutines can read or write at the same time.
func cloneContext(c LogContext) LogContext {
	if c == nil {
		return LogContext{}
	}
	return maps.Clone(c)
}

func (l *defaultLogger) Context() LogContext {
	return l.logContext
}

func (l *defaultLogger) Timed() Logger {
	return l.With(LogContext{
		timed: time.Now(),
	})
}

func (l *defaultLogger) Debugf(format string, args ...any) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogDebug(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Errorf(format string, args ...any) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogError(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Infof(format string, args ...any) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogInfo(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Warnf(format string, args ...any) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogWarn(message, toKeyValuePairs(l.logContext)...)
}
