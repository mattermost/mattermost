package logger

import (
	"fmt"
	"testing"
	"time"
)

type testLogger struct {
	testing.TB
	logContext LogContext
}

// NewTestLogger creates a logger for testing purposes.
func NewTestLogger() Logger {
	return &testLogger{}
}

func (l *testLogger) With(logContext LogContext) Logger {
	newl := *l
	if len(newl.logContext) == 0 {
		newl.logContext = map[string]interface{}{}
	}
	for k, v := range logContext {
		newl.logContext[k] = v
	}
	return &newl
}

func (l *testLogger) WithError(err error) Logger {
	newl := *l
	if len(newl.logContext) == 0 {
		newl.logContext = map[string]interface{}{}
	}
	newl.logContext[ErrorKey] = err.Error()
	return &newl
}

func (l *testLogger) Context() LogContext {
	return l.logContext
}

func (l *testLogger) Timed() Logger {
	return l.With(LogContext{
		timed: time.Now(),
	})
}

func (l *testLogger) logf(prefix, format string, args ...interface{}) {
	out := fmt.Sprintf(prefix+": "+format, args...)
	if len(l.logContext) > 0 {
		measure(l.logContext)
		out += fmt.Sprintf(" -- %+v", l.logContext)
	}
	l.TB.Logf(out)
}

func (l *testLogger) Debugf(format string, args ...interface{}) { l.logf("DEBUG", format, args...) }
func (l *testLogger) Errorf(format string, args ...interface{}) { l.logf("ERROR", format, args...) }
func (l *testLogger) Infof(format string, args ...interface{})  { l.logf("INFO", format, args...) }
func (l *testLogger) Warnf(format string, args ...interface{})  { l.logf("WARN", format, args...) }
