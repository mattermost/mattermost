// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package logger

import (
	"fmt"
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
	if len(newLogger.logContext) == 0 {
		newLogger.logContext = map[string]interface{}{}
	}
	for k, v := range logContext {
		newLogger.logContext[k] = v
	}
	return &newLogger
}

func (l *defaultLogger) WithError(err error) Logger {
	newLogger := *l
	if len(newLogger.logContext) == 0 {
		newLogger.logContext = map[string]interface{}{}
	}
	newLogger.logContext[ErrorKey] = err.Error()
	return &newLogger
}

func (l *defaultLogger) Context() LogContext {
	return l.logContext
}

func (l *defaultLogger) Timed() Logger {
	return l.With(LogContext{
		timed: time.Now(),
	})
}

func (l *defaultLogger) Debugf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogDebug(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Errorf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogError(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Infof(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogInfo(message, toKeyValuePairs(l.logContext)...)
}

func (l *defaultLogger) Warnf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.logAPI.LogWarn(message, toKeyValuePairs(l.logContext)...)
}
